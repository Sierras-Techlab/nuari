import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type Organization, type OrganizationMember, OrganizationRole, type User } from '../generated/prisma/client.js';
import type { TransactionContext } from '../common/transaction.js';
import { Clock } from '../common/clock.js';
import { randomToken, sha256 } from '../common/crypto.js';
import { ApiError } from '../common/errors.js';
import type { SessionPrincipal } from '../common/request.js';
import { IdentityService, userDto } from '../identity/identity.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { EmailDispatcher } from '../integrations/email-dispatcher.js';
import { CreateOrganizationDto, CreateInvitationDto, REGIONAL_CONFIG, type SupportedCountry, UpdateMemberRoleDto, UpdateOrganizationDto } from './organizations.dto.js';


export const organizationDto = (org: Organization) => ({
  id: org.id,
  name: org.name,
  slug: org.slug,
  businessType: org.businessType,
  description: org.description ?? '',
  email: org.email ?? '',
  phone: org.phone ?? '',
  website: org.website ?? '',
  country: org.country ?? '',
  state: org.state ?? '',
  city: org.city ?? '',
  zip: org.zip ?? '',
  address: org.address ?? '',
  timezone: org.timezone,
  currency: org.currency,
  logoUrl: org.logoUrl ?? null,
  createdAt: org.createdAt.toISOString(),
  updatedAt: org.updatedAt.toISOString(),
});
export const membershipDto = (member: OrganizationMember) => ({ id: member.id, organizationId: member.organizationId, role: member.role, status: member.status });
export const memberDetailDto = (member: OrganizationMember & { user: { id: string; name: string; email: string } }) => ({
  id: member.id,
  userId: member.userId,
  name: member.user.name,
  email: member.user.email,
  role: member.role,
  status: member.status,
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString(),
});
export const invitationDto = (inv: { id: string; organizationId: string; email: string; role: OrganizationRole; createdAt: Date; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null }) => ({
  id: inv.id,
  organizationId: inv.organizationId,
  email: inv.email,
  role: inv.role,
  createdAt: inv.createdAt.toISOString(),
  expiresAt: inv.expiresAt.toISOString(),
  acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
  revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
});
export const onboardingRequestHash = (input: CreateOrganizationDto): string => sha256(JSON.stringify({ name: input.name, slug: input.slug, businessType: input.businessType, planCode: input.planCode }));

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly identity: IdentityService,
    private readonly subscriptions: SubscriptionsService,
    private readonly clock: Clock,
    private readonly emails: EmailDispatcher,
  ) {}
  listActive(userId: string, tx: TransactionContext = this.db) {

    return tx.organizationMember.findMany({ where: { userId, status: 'ACTIVE' }, include: { organization: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }
  async resolveMember(userId: string, organizationId: string, tx: TransactionContext = this.db) {
    const member = await tx.organizationMember.findFirst({ where: { userId, organizationId, status: 'ACTIVE' }, include: { organization: true } });
    if (!member) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
    return member;
  }
  private async eligibility(user: User, hasMembers: boolean, hasInactiveMembership: boolean, tx: TransactionContext) {
    if (hasMembers) return { canCreateOrganization: false, reason: 'HAS_MEMBERSHIP' as const };
    const hasTrialGrant = await this.subscriptions.hasTrialGrant(user.id, tx);
    const canCreateOrganization = user.emailVerifiedAt !== null && !hasTrialGrant;
    if (hasInactiveMembership) return { canCreateOrganization, reason: 'ACCESS_REVOKED' as const };
    if (hasTrialGrant) return { canCreateOrganization: false, reason: 'TRIAL_ALREADY_USED' as const };
    if (!user.emailVerifiedAt) return { canCreateOrganization: false, reason: 'EMAIL_UNVERIFIED' as const };
    return { canCreateOrganization: true, reason: 'ELIGIBLE' as const };
  }
  async snapshot(principal: SessionPrincipal, requestedOrganizationId?: string) {
    return this.db.$transaction(async tx => {
      const user = await this.identity.lockUser(tx, principal.userId);
      await this.identity.assertSession(tx, principal);
      const members = await this.listActive(user.id, tx);
      const hasInactiveMembership = members.length === 0 && Boolean(await tx.organizationMember.findFirst({ where: { userId: user.id, status: 'INACTIVE' }, select: { id: true } }));
      if (requestedOrganizationId) await this.resolveMember(user.id, requestedOrganizationId, tx);
      const selected = members.find(member => member.organizationId === (requestedOrganizationId ?? principal.activeOrganizationId)) ?? members[0] ?? null;
      const activeOrganizationId = selected?.organizationId ?? null;
      await this.identity.selectOrganization(tx, principal, activeOrganizationId);
      const access = selected ? (await this.subscriptions.state(selected.organizationId, selected.role, this.clock.now(), tx)).access : null;
      return { user: userDto(user), memberships: members.map(member => ({ id: member.id, role: member.role, organization: organizationDto(member.organization) })), activeOrganizationId, access, onboarding: await this.eligibility(user, members.length > 0, hasInactiveMembership, tx) };
    });
  }
  async createInitial(principal: SessionPrincipal, key: string, input: CreateOrganizationDto) {
    const requestHash = onboardingRequestHash(input);
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.db.$transaction(async tx => {
          const user = await this.identity.lockUser(tx, principal.userId);
          await this.identity.assertSession(tx, principal);
          const existing = await tx.onboardingSubmission.findUnique({ where: { userId_key: { userId: user.id, key } } });
          if (existing) {
            if (existing.requestHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'La clave ya fue usada para otra solicitud.');
            const member = await this.resolveMember(user.id, existing.organizationId, tx);
            await this.identity.selectOrganization(tx, principal, member.organizationId);
            const state = await this.subscriptions.state(member.organizationId, member.role, this.clock.now(), tx);
            return { replay: true, organization: organizationDto(member.organization), membership: membershipDto(member), subscription: state.subscription };
          }
          const members = await this.listActive(user.id, tx);
          if (members.length) throw new ApiError(409, 'ONBOARDING_ALREADY_COMPLETED', 'Ya tenés una organización disponible.');
          if (await this.subscriptions.hasTrialGrant(user.id, tx)) throw new ApiError(403, 'TRIAL_ALREADY_USED', 'La prueba de esta cuenta ya fue utilizada.');
          if (!user.emailVerifiedAt) throw new ApiError(403, 'EMAIL_UNVERIFIED', 'Verificá tu correo para iniciar la prueba.');
          const now = this.clock.now();
          const organization = await tx.organization.create({ data: { name: input.name, slug: input.slug, businessType: input.businessType, createdAt: now, updatedAt: now } });
          const member = await tx.organizationMember.create({ data: { userId: user.id, organizationId: organization.id, role: 'OWNER', status: 'ACTIVE', createdAt: now, updatedAt: now } });
          await this.subscriptions.createTrial(tx, user.id, organization.id, input.planCode, now);
          await tx.onboardingSubmission.create({ data: { userId: user.id, key, requestHash, organizationId: organization.id, createdAt: now } });
          await this.identity.selectOrganization(tx, principal, organization.id);
          const state = await this.subscriptions.state(organization.id, member.role, now, tx);
          return { replay: false, organization: organizationDto(organization), membership: membershipDto(member), subscription: state.subscription };
        }, { maxWait: 10_000, timeout: 15_000 });
        if (!result.replay) this.logger.log('organization_created_trial_granted');
        return result;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' && attempt < 2) continue;
          if (error.code === 'P2002') {
            const target: unknown = error.meta?.target;
            const matches = (field: string, constraint: string): boolean =>
              (Array.isArray(target) && target.includes(field)) || target === constraint;
            if (error.meta?.modelName === 'Organization' && matches('slug', 'Organization_slug_key')) {
              throw new ApiError(409, 'SLUG_TAKEN', 'Ese enlace ya está en uso.', { slug: ['Elegí otro enlace.'] });
            }
            if (error.meta?.modelName === 'TrialGrant' && matches('userId', 'TrialGrant_userId_key')) {
              throw new ApiError(403, 'TRIAL_ALREADY_USED', 'La prueba de esta cuenta ya fue utilizada.');
            }
            if (error.meta?.modelName === 'OrganizationMember' && matches('userId', 'OrganizationMember_userId_organizationId_key')) {
              throw new ApiError(409, 'ONBOARDING_ALREADY_COMPLETED', 'Ya tenés una organización disponible.');
            }
          }
        }
        throw error;
      }
    }
  }

  async updateSettings(
    member: OrganizationMember & { organization: Organization },
    actorUserId: string,
    input: UpdateOrganizationDto,
  ) {
    if (member.role === 'EMPLOYEE') {
      throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para modificar la organización.');
    }

    if (member.role === 'ADMIN' && input.slug !== undefined && input.slug !== member.organization.slug) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Solo el propietario (OWNER) puede modificar el enlace permanente (slug).');
    }

    const currentCountry = input.country !== undefined ? input.country : (member.organization.country ?? 'AR');
    const countryKey = currentCountry as SupportedCountry;
    const regional = REGIONAL_CONFIG[countryKey];

    if (!regional) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'El país seleccionado no es válido.', {
        country: ['Seleccioná un país admitido (AR, UY, CL, BR, MX, CO, PE).'],
      });
    }

    if (input.currency !== undefined && input.currency !== regional.currency) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'La moneda debe corresponder al país seleccionado.', {
        currency: [`La moneda para ${currentCountry} debe ser ${regional.currency}.`],
      });
    }

    if (input.timezone !== undefined && !regional.timezones.includes(input.timezone as never)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'La zona horaria no es válida para el país seleccionado.', {
        timezone: ['Elegí una zona horaria válida para el país.'],
      });
    }

    if (input.logoUrl !== undefined && input.logoUrl !== null && input.logoUrl.trim() !== '' && input.logoUrl !== member.organization.logoUrl) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'La carga directa de logoUrl estará disponible próximamente.', {
        logoUrl: ['El almacenamiento de archivos aún no está habilitado.'],
      });
    }

    const now = this.clock.now();
    const dataToUpdate: Prisma.OrganizationUpdateInput = {
      updatedAt: now,
    };

    if (input.name !== undefined) dataToUpdate.name = input.name;
    if (input.slug !== undefined && member.role === 'OWNER') dataToUpdate.slug = input.slug;
    if (input.description !== undefined) dataToUpdate.description = input.description === '' ? null : input.description;
    if (input.email !== undefined) dataToUpdate.email = input.email === '' ? null : input.email;
    if (input.phone !== undefined) dataToUpdate.phone = input.phone === '' ? null : input.phone;
    if (input.website !== undefined) dataToUpdate.website = input.website === '' ? null : input.website;
    if (input.country !== undefined) {
      dataToUpdate.country = input.country;
      if (input.currency === undefined) {
        dataToUpdate.currency = regional.currency;
      }
      if (input.timezone === undefined && !regional.timezones.includes(member.organization.timezone as never)) {
        dataToUpdate.timezone = regional.timezones[0];
      }
    }
    if (input.state !== undefined) dataToUpdate.state = input.state === '' ? null : input.state;
    if (input.city !== undefined) dataToUpdate.city = input.city === '' ? null : input.city;
    if (input.zip !== undefined) dataToUpdate.zip = input.zip === '' ? null : input.zip;
    if (input.address !== undefined) dataToUpdate.address = input.address === '' ? null : input.address;
    if (input.timezone !== undefined) dataToUpdate.timezone = input.timezone;
    if (input.currency !== undefined) dataToUpdate.currency = input.currency;
    if (input.logoUrl !== undefined) dataToUpdate.logoUrl = (input.logoUrl === '' || input.logoUrl === null) ? null : input.logoUrl;

    try {
      return await this.db.$transaction(async (tx) => {
        const updated = await tx.organization.update({
          where: { id: member.organizationId },
          data: dataToUpdate,
        });

        const sensitiveChanges: string[] = [];
        if (input.slug !== undefined && input.slug !== member.organization.slug) sensitiveChanges.push(`slug:${input.slug}`);
        if (input.name !== undefined && input.name !== member.organization.name) sensitiveChanges.push(`name:${input.name}`);
        if (input.country !== undefined && input.country !== member.organization.country) sensitiveChanges.push(`country:${input.country}`);
        if (input.timezone !== undefined && input.timezone !== member.organization.timezone) sensitiveChanges.push(`timezone:${input.timezone}`);
        if (input.currency !== undefined && input.currency !== member.organization.currency) sensitiveChanges.push(`currency:${input.currency}`);

        await tx.organizationAuditLog.create({
          data: {
            organizationId: member.organizationId,
            actorUserId,
            action: 'ORGANIZATION_SETTINGS_UPDATED',
            targetId: member.organizationId,
            metadata: sensitiveChanges.length > 0 ? sensitiveChanges.join(', ') : 'commercial_fields_updated',
            createdAt: now,
          },
        });

        return organizationDto(updated);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target: unknown = error.meta?.target;
        const matches = (field: string, constraint: string): boolean =>
          (Array.isArray(target) && target.includes(field)) || target === constraint;
        if (error.meta?.modelName === 'Organization' && matches('slug', 'Organization_slug_key')) {
          throw new ApiError(409, 'SLUG_TAKEN', 'Ese enlace ya está en uso.', { slug: ['Elegí otro enlace.'] });
        }
      }
      throw error;
    }
  }

  async listMembers(organizationId: string) {
    const members = await this.db.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return members.map(memberDetailDto);
  }

  async updateMemberRole(
    currentMember: OrganizationMember,
    actorUserId: string,
    targetMemberId: string,
    input: UpdateMemberRoleDto,
  ) {
    if (currentMember.role === 'EMPLOYEE') {
      throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para administrar miembros.');
    }

    return this.db.$transaction(async (tx) => {
      const target = await tx.organizationMember.findFirst({
        where: { id: targetMemberId, organizationId: currentMember.organizationId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      if (!target) throw new ApiError(404, 'MEMBER_NOT_FOUND', 'El miembro no fue encontrado.');

      if (currentMember.role === 'ADMIN') {
        if (target.role !== 'EMPLOYEE' || input.role !== 'EMPLOYEE') {
          throw new ApiError(403, 'PERMISSION_DENIED', 'Los administradores solo pueden gestionar miembros con rol EMPLOYEE.');
        }
      }

      if (target.role === 'OWNER' && input.role !== 'OWNER') {
        const ownersCount = await tx.organizationMember.count({
          where: { organizationId: currentMember.organizationId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (ownersCount <= 1) {
          throw new ApiError(400, 'CANNOT_REMOVE_LAST_OWNER', 'La organización debe conservar al menos un propietario (OWNER).');
        }
      }

      if (currentMember.role === 'OWNER' && currentMember.id === target.id && input.role !== 'OWNER') {
        const ownersCount = await tx.organizationMember.count({
          where: { organizationId: currentMember.organizationId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (ownersCount <= 1) {
          throw new ApiError(400, 'CANNOT_REMOVE_LAST_OWNER', 'No podés degradar tu propio rol de propietario si sos el único.');
        }
      }

      const now = this.clock.now();
      const updated = await tx.organizationMember.update({
        where: { id: target.id },
        data: { role: input.role, updatedAt: now },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await tx.organizationAuditLog.create({
        data: {
          organizationId: currentMember.organizationId,
          actorUserId,
          action: 'MEMBER_ROLE_UPDATED',
          targetId: target.id,
          metadata: `role:${target.role}->${input.role}, targetUser:${target.user.email}`,
          createdAt: now,
        },
      });

      return memberDetailDto(updated);
    });
  }

  async removeMember(
    currentMember: OrganizationMember,
    actorUserId: string,
    targetMemberId: string,
  ) {
    if (currentMember.role === 'EMPLOYEE') {
      throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para revocar accesos.');
    }

    return this.db.$transaction(async (tx) => {
      const target = await tx.organizationMember.findFirst({
        where: { id: targetMemberId, organizationId: currentMember.organizationId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      if (!target) throw new ApiError(404, 'MEMBER_NOT_FOUND', 'El miembro no fue encontrado.');

      if (currentMember.role === 'ADMIN' && target.role !== 'EMPLOYEE') {
        throw new ApiError(403, 'PERMISSION_DENIED', 'Los administradores solo pueden revocar accesos a miembros con rol EMPLOYEE.');
      }

      if (target.role === 'OWNER') {
        const ownersCount = await tx.organizationMember.count({
          where: { organizationId: currentMember.organizationId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (ownersCount <= 1) {
          throw new ApiError(400, 'CANNOT_REMOVE_LAST_OWNER', 'No se puede remover al único propietario (OWNER) de la organización.');
        }
      }

      const now = this.clock.now();
      const updated = await tx.organizationMember.update({
        where: { id: target.id },
        data: { status: 'INACTIVE', updatedAt: now },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await tx.organizationAuditLog.create({
        data: {
          organizationId: currentMember.organizationId,
          actorUserId,
          action: 'MEMBER_REMOVED',
          targetId: target.id,
          metadata: `revokedUser:${target.user.email}, role:${target.role}`,
          createdAt: now,
        },
      });

      return memberDetailDto(updated);
    });
  }

  async listInvitations(organizationId: string) {
    const now = this.clock.now();
    const invitations = await this.db.organizationInvitation.findMany({
      where: {
        organizationId,
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map(invitationDto);
  }

  async createInvitation(
    currentMember: OrganizationMember & { organization: Organization },
    actorUserId: string,
    input: CreateInvitationDto,
  ) {
    if (currentMember.role === 'EMPLOYEE') {
      throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para invitar miembros.');
    }

    if (currentMember.role === 'ADMIN' && input.role !== 'EMPLOYEE') {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Los administradores solo pueden invitar con rol EMPLOYEE.');
    }

    const email = input.email.trim().toLowerCase();
    const now = this.clock.now();

    const existingMember = await this.db.organizationMember.findFirst({
      where: {
        organizationId: currentMember.organizationId,
        status: 'ACTIVE',
        user: { email },
      },
    });
    if (existingMember) {
      throw new ApiError(409, 'ALREADY_MEMBER', 'Este correo ya pertenece a un miembro activo de la organización.');
    }

    const token = randomToken();
    const tokenHash = sha256(token);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.db.$transaction(async (tx) => {
      await tx.organizationInvitation.updateMany({
        where: {
          organizationId: currentMember.organizationId,
          email,
          revokedAt: null,
          acceptedAt: null,
        },
        data: { revokedAt: now },
      });

      const created = await tx.organizationInvitation.create({
        data: {
          organizationId: currentMember.organizationId,
          email,
          role: input.role,
          tokenHash,
          invitedByUserId: actorUserId,
          createdAt: now,
          expiresAt,
        },
      });

      await tx.organizationAuditLog.create({
        data: {
          organizationId: currentMember.organizationId,
          actorUserId,
          action: 'INVITATION_CREATED',
          targetId: created.id,
          metadata: `email:${email}, role:${input.role}`,
          createdAt: now,
        },
      });

      return created;
    });

    this.emails.enqueue({
      to: email,
      subject: `Invitación para unirte a ${currentMember.organization.name} en Nuari`,
      text: `Fuiste invitado a unirte a ${currentMember.organization.name} en Nuari como ${input.role}.\n\nPara aceptar la invitación, ingresá en: /invitacion/${token}`,
    });


    return {
      invitation: invitationDto(invitation),
      token,
    };
  }

  async revokeInvitation(
    currentMember: OrganizationMember,
    actorUserId: string,
    invitationId: string,
  ) {
    if (currentMember.role === 'EMPLOYEE') {
      throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para revocar invitaciones.');
    }

    const invitation = await this.db.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId: currentMember.organizationId },
    });
    if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'La invitación no fue encontrada.');

    if (currentMember.role === 'ADMIN' && invitation.role !== 'EMPLOYEE') {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Los administradores solo pueden revocar invitaciones de rol EMPLOYEE.');
    }

    const now = this.clock.now();
    await this.db.$transaction(async (tx) => {
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: now },
      });

      await tx.organizationAuditLog.create({
        data: {
          organizationId: currentMember.organizationId,
          actorUserId,
          action: 'INVITATION_REVOKED',
          targetId: invitation.id,
          metadata: `email:${invitation.email}, role:${invitation.role}`,
          createdAt: now,
        },
      });
    });

    return { success: true };
  }

  async getInvitationByToken(token: string) {
    const tokenHash = sha256(token);
    const now = this.clock.now();
    const invitation = await this.db.organizationInvitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= now) {
      throw new ApiError(400, 'INVALID_INVITATION', 'La invitación es inválida, fue revocada o ya expiró.');
    }

    return {
      id: invitation.id,
      organizationName: invitation.organization.name,
      organizationSlug: invitation.organization.slug,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptInvitation(token: string, principal: SessionPrincipal) {
    const tokenHash = sha256(token);
    const now = this.clock.now();

    return this.db.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { tokenHash },
        include: { organization: true },
      });

      if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= now) {
        throw new ApiError(400, 'INVALID_INVITATION', 'La invitación es inválida, fue revocada o ya expiró.');
      }

      const user = await tx.user.findUnique({
        where: { id: principal.userId },
      });
      if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Usuario no autenticado.');

      if (!user.emailVerifiedAt) {
        throw new ApiError(403, 'EMAIL_UNVERIFIED', 'Verificá tu correo electrónico antes de aceptar una invitación.');
      }

      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ApiError(403, 'EMAIL_MISMATCH', 'El correo de tu cuenta no coincide con el correo invitado.', {
          email: [`Esta invitación fue enviada a ${invitation.email}.`],
        });
      }

      const existingMember = await tx.organizationMember.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: invitation.organizationId } },
      });

      let member: OrganizationMember;
      if (existingMember) {
        member = await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: { status: 'ACTIVE', role: invitation.role, updatedAt: now },
        });
      } else {
        member = await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
            status: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: now },
      });

      await this.identity.selectOrganization(tx, principal, invitation.organizationId);

      await tx.organizationAuditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorUserId: user.id,
          action: 'INVITATION_ACCEPTED',
          targetId: invitation.id,
          metadata: `acceptedUser:${user.email}, role:${invitation.role}`,
          createdAt: now,
        },
      });

      return {
        organization: organizationDto(invitation.organization),
        membership: membershipDto(member),
      };
    });
  }
}


