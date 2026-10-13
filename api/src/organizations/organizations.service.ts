import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type Organization, type OrganizationMember, type User } from '../generated/prisma/client.js';
import type { TransactionContext } from '../common/transaction.js';
import { Clock } from '../common/clock.js';
import { sha256 } from '../common/crypto.js';
import { ApiError } from '../common/errors.js';
import type { SessionPrincipal } from '../common/request.js';
import { IdentityService, userDto } from '../identity/identity.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { CreateOrganizationDto } from './organizations.dto.js';

export const organizationDto = (org: Organization) => ({ id: org.id, name: org.name, slug: org.slug, businessType: org.businessType, createdAt: org.createdAt.toISOString(), updatedAt: org.updatedAt.toISOString() });
export const membershipDto = (member: OrganizationMember) => ({ id: member.id, organizationId: member.organizationId, role: member.role, status: member.status });
export const onboardingRequestHash = (input: CreateOrganizationDto): string => sha256(JSON.stringify({ name: input.name, slug: input.slug, businessType: input.businessType, planCode: input.planCode }));

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  constructor(private readonly db: PrismaService, private readonly identity: IdentityService, private readonly subscriptions: SubscriptionsService, private readonly clock: Clock) {}
  listActive(userId: string, tx: TransactionContext = this.db) {
    return tx.organizationMember.findMany({ where: { userId, status: 'ACTIVE' }, include: { organization: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }
  async resolveMember(userId: string, organizationId: string, tx: TransactionContext = this.db) {
    const member = await tx.organizationMember.findFirst({ where: { userId, organizationId, status: 'ACTIVE' }, include: { organization: true } });
    if (!member) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
    return member;
  }
  private async eligibility(user: User, hasMembers: boolean, tx: TransactionContext) {
    if (hasMembers) return { canCreateOrganization: false, reason: 'HAS_MEMBERSHIP' as const };
    if (await this.subscriptions.hasTrialGrant(user.id, tx)) return { canCreateOrganization: false, reason: 'TRIAL_ALREADY_USED' as const };
    if (!user.emailVerifiedAt) return { canCreateOrganization: false, reason: 'EMAIL_UNVERIFIED' as const };
    return { canCreateOrganization: true, reason: 'ELIGIBLE' as const };
  }
  async snapshot(principal: SessionPrincipal, requestedOrganizationId?: string) {
    return this.db.$transaction(async tx => {
      const user = await this.identity.lockUser(tx, principal.userId);
      await this.identity.assertSession(tx, principal);
      const members = await this.listActive(user.id, tx);
      if (requestedOrganizationId) await this.resolveMember(user.id, requestedOrganizationId, tx);
      const selected = members.find(member => member.organizationId === (requestedOrganizationId ?? principal.activeOrganizationId)) ?? members[0] ?? null;
      const activeOrganizationId = selected?.organizationId ?? null;
      await this.identity.selectOrganization(tx, principal, activeOrganizationId);
      const access = selected ? (await this.subscriptions.state(selected.organizationId, selected.role, this.clock.now(), tx)).access : null;
      return { user: userDto(user), memberships: members.map(member => ({ id: member.id, role: member.role, organization: organizationDto(member.organization) })), activeOrganizationId, access, onboarding: await this.eligibility(user, members.length > 0, tx) };
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
}
