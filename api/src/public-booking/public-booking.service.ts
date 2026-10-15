import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { Clock } from '../common/clock.js';
import { ApiError } from '../common/errors.js';
import { parseIfMatch } from '../common/if-match.js';
import { SecurityConfig } from '../common/security.config.js';
import type { TenantContext } from '../organizations/tenant.guard.js';
import { deriveManagementToken, hashManagementToken, matchesManagementToken } from './management-token.js';
import type { PublicAvailabilityQueryDto, PublicCancelDto, PublicCreateAppointmentDto, PublicManageTokenDto, PublicRescheduleAvailabilityDto, PublicRescheduleDto, RevokeManagementLinkDto } from './public-booking.dto.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { AppointmentLifecycleService } from '../appointments/appointment-lifecycle.service.js';
import { toLocalDateTime } from '../availability/time-zone-adapter.js';
import { RateLimiter } from '../common/rate-limiter.js';
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../customers/customers.service.js';

const missing = () => new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
const tokenMissing = () => new ApiError(404, 'MANAGEMENT_LINK_NOT_AVAILABLE', 'El enlace de gestión no está disponible.');
const validSubscription = (subscription: { status: string; trialStartedAt: Date; trialEndsAt: Date; paidThrough: Date | null } | null, now: Date) =>
  !!subscription && (subscription.status === 'TRIALING'
    ? subscription.trialStartedAt <= now && now < subscription.trialEndsAt
    : subscription.status === 'ACTIVE' && !!subscription.paidThrough && subscription.paidThrough > now);

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly db: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService,
    private readonly lifecycle: AppointmentLifecycleService,
    private readonly clock: Clock,
    private readonly security: SecurityConfig,
    private readonly rate: RateLimiter,
  ) {}

  async catalog(slug: string) {
    const organization = await this.db.organization.findUnique({
      where: { slug }, select: { id: true, name: true, timezone: true, currency: true },
    });
    if (!organization) throw missing();
    const settings = await this.db.schedulingSettings.findUnique({ where: { organizationId: organization.id } });
    const subscription = await this.db.subscription.findUnique({ where: { organizationId: organization.id } });
    if (!settings?.publicBookingEnabled || !validSubscription(subscription, this.clock.now())) throw missing();
    const services = await this.db.service.findMany({
      where: { organizationId: organization.id, active: true, publicBookable: true },
      select: { id: true, name: true, description: true, durationMinutes: true, pricingType: true, price: true, currency: true, staffSelectionMode: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const items = await Promise.all(services.map(async service => {
      const rows = service.staffSelectionMode === 'CUSTOMER_CHOICE'
        ? await this.db.staffService.findMany({
          where: { organizationId: organization.id, serviceId: service.id, staffMember: { active: true } },
          select: { staffMember: { select: { id: true, name: true } } }, orderBy: { staffMemberId: 'asc' }, take: 51,
        }) : [];
      return {
        id: service.id, name: service.name, description: service.description, durationMinutes: service.durationMinutes,
        pricingType: service.pricingType, price: service.price?.toFixed(2) ?? null, currency: service.currency,
        staffSelectionMode: service.staffSelectionMode,
        ...(service.staffSelectionMode === 'CUSTOMER_CHOICE' ? {
          staff: rows.slice(0, 50).map(row => row.staffMember), staffPage: { limit: 50, hasMore: rows.length > 50, nextOffset: rows.length > 50 ? 50 : null },
        } : {}),
      };
    }));
    return {
      organization,
      timeZone: organization.timezone,
      policy: { slotStepMinutes: settings.slotStepMinutes, minNoticeMinutes: settings.publicMinNoticeMinutes, maxAdvanceDays: settings.publicMaxAdvanceDays, cancelNoticeMinutes: settings.publicCancelNoticeMinutes },
      services: items,
    };
  }

  async listPublicStaff(slug: string, serviceId: string, offset: number) {
    const { organization } = await this.published(slug);
    const service = await this.db.service.findFirst({ where: { id: serviceId, organizationId: organization.id, active: true, publicBookable: true }, select: { id: true, staffSelectionMode: true } });
    if (!service || service.staffSelectionMode !== 'CUSTOMER_CHOICE') throw missing();
    const rows = await this.db.staffService.findMany({
      where: { organizationId: organization.id, serviceId, staffMember: { active: true } },
      select: { staffMember: { select: { id: true, name: true } } }, orderBy: { staffMemberId: 'asc' }, skip: offset, take: 51,
    });
    const hasMore = rows.length > 50;
    return { items: rows.slice(0, 50).map(row => row.staffMember), pageInfo: { limit: 50, offset, hasMore, nextOffset: hasMore ? offset + 50 : null } };
  }

  async findAvailability(slug: string, query: PublicAvailabilityQueryDto) {
    const result = await this.availability.findPublic(slug, query);
    const organization = await this.db.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!organization) throw missing();
    const service = await this.db.service.findFirst({ where: { id: query.serviceId, organizationId: organization.id, active: true, publicBookable: true }, select: { staffSelectionMode: true } });
    if (!service) throw missing();
    return {
      ...result,
      slots: result.slots.map(slot => ({ ...slot, staff: service.staffSelectionMode === 'CUSTOMER_CHOICE' ? slot.staff : [] })),
    };
  }

  async create(slug: string, idempotencyKey: string, input: PublicCreateAppointmentDto) {
    const organization = await this.db.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!organization) throw missing();
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    const replay = await this.db.bookingSubmission.findUnique({
      where: { organizationId_actorScope_keyHash: { organizationId: organization.id, actorScope: 'PUBLIC', keyHash } },
      select: { id: true },
    });
    if (!replay) {
      const email = normalizeCustomerEmail(input.customer.email);
      const phone = normalizeCustomerPhone(input.customer.phone);
      const contacts = new Set([email, phone].filter((value): value is string => !!value));
      if (!contacts.size) throw new ApiError(400, 'VALIDATION_ERROR', 'Ingresá un teléfono o email válido.');
      for (const contact of contacts) await this.rate.consume('public-booking-create-contact', `${slug}:${contact}`, 3, 60 * 60_000);
      await this.rate.consume('public-booking-create-tenant', slug, 300, 60 * 60_000);
    }
    return this.appointments.createPublic(slug, idempotencyKey, input);
  }

  async resolve(slug: string, input: PublicManageTokenDto) {
    const { appointment } = await this.findByToken(slug, input.token);
    const now = this.clock.now();
    const settings = await this.db.schedulingSettings.findUnique({ where: { organizationId: appointment.organizationId } });
    const subscription = await this.db.subscription.findUnique({ where: { organizationId: appointment.organizationId } });
    const service = await this.db.service.findFirst({ where: { id: appointment.serviceId, organizationId: appointment.organizationId, active: true, publicBookable: true }, select: { id: true, staffSelectionMode: true } });
    const rebookingAvailable = !!settings?.publicBookingEnabled && validSubscription(subscription, now) &&
      !!service && service.staffSelectionMode === appointment.serviceSelectionModeSnapshot;
    return {
      id: appointment.id, status: appointment.status, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString(),
      serviceId: appointment.serviceId, staffSelectionMode: service?.staffSelectionMode ?? appointment.serviceSelectionModeSnapshot,
      assignment: { kind: appointment.assignmentKind, ...(appointment.staffMemberId ? { staffMemberId: appointment.staffMemberId } : {}) },
      durationMinutes: appointment.durationMinutes, serviceName: appointment.serviceNameSnapshot, staffName: appointment.staffNameSnapshot,
      timeZone: appointment.timezoneSnapshot, version: appointment.version,
      actions: {
        canCancel: appointment.status === 'CONFIRMED' && now < appointment.startAt && appointment.startAt.getTime() - now.getTime() >= appointment.publicCancelNoticeMinutesSnapshot * 60_000,
        canReschedule: rebookingAvailable && appointment.status === 'CONFIRMED' && now < appointment.startAt && appointment.startAt.getTime() - now.getTime() >= appointment.publicCancelNoticeMinutesSnapshot * 60_000,
      },
    };
  }

  async findRescheduleAvailability(slug: string, appointmentId: string, input: PublicRescheduleAvailabilityDto, ifMatch: string | undefined) {
    const expectedVersion = parseIfMatch(ifMatch);
    const { organization, appointment } = await this.findByToken(slug, input.token);
    if (appointment.id !== appointmentId) throw tokenMissing();
    if (appointment.version !== expectedVersion) throw new ApiError(412, 'VERSION_CONFLICT', 'La reserva cambió. Volvé a consultar el enlace.');

    const now = this.clock.now();
    if (appointment.status !== 'CONFIRMED' || now >= appointment.startAt ||
      appointment.startAt.getTime() - now.getTime() < appointment.publicCancelNoticeMinutesSnapshot * 60_000) {
      throw new ApiError(409, 'INVALID_APPOINTMENT_TRANSITION', 'La reserva ya no admite reprogramación.');
    }

    const [settings, subscription, service] = await Promise.all([
      this.db.schedulingSettings.findUnique({ where: { organizationId: organization.id } }),
      this.db.subscription.findUnique({ where: { organizationId: organization.id } }),
      this.db.service.findFirst({
        where: { id: appointment.serviceId, organizationId: organization.id, active: true, publicBookable: true },
        select: { id: true, staffSelectionMode: true },
      }),
    ]);
    if (!settings?.publicBookingEnabled || !validSubscription(subscription, now) || !service ||
      service.staffSelectionMode !== appointment.serviceSelectionModeSnapshot) throw missing();

    const result = await this.availability.findPublicForReschedule(slug, {
      serviceId: appointment.serviceId, selection: input.selection, staffMemberId: input.staffMemberId,
      fromDate: input.fromDate, toDate: input.toDate, cursor: input.cursor,
    }, appointment.id);
    return {
      ...result,
      slots: result.slots.map(slot => ({ ...slot, staff: service.staffSelectionMode === 'CUSTOMER_CHOICE' ? slot.staff : [] })),
    };
  }

  async cancel(slug: string, appointmentId: string, input: PublicCancelDto, ifMatch: string | undefined) {
    const expectedVersion = parseIfMatch(ifMatch);
    const { organization, appointment: initial } = await this.findByToken(slug, input.token);
    if (initial.id !== appointmentId) throw tokenMissing();
    return this.db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${organization.id}::uuid FOR SHARE`);
      const day = this.localDate(initial.startAt, organization.timezone);
      const coordinationKey = initial.staffMemberId ? day : `NO_ASSIGNMENT:${initial.serviceId}:${day}`;
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${organization.id}), hashtext(${coordinationKey}))`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Service" WHERE "organizationId" = ${organization.id}::uuid AND "id" = ${initial.serviceId}::uuid FOR SHARE`);
      if (initial.staffMemberId) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "StaffMember" WHERE "organizationId" = ${organization.id}::uuid AND "id" = ${initial.staffMemberId}::uuid FOR SHARE`);
      const calendars = await tx.bookingCalendar.findMany({ where: { organizationId: organization.id, OR: [{ kind: 'BUSINESS' }, ...(initial.staffMemberId ? [{ staffMemberId: initial.staffMemberId }] : [])] }, select: { id: true }, orderBy: { id: 'asc' } });
      for (const calendar of calendars) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "BookingCalendar" WHERE "organizationId" = ${organization.id}::uuid AND "id" = ${calendar.id}::uuid FOR SHARE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Appointment" WHERE "organizationId" = ${organization.id}::uuid AND "id" = ${initial.id}::uuid FOR UPDATE`);
      const appointment = await tx.appointment.findFirst({ where: { organizationId: organization.id, id: initial.id } });
      if (!appointment || !this.tokenValid(appointment, input.token, slug)) throw tokenMissing();
      if (appointment.version !== expectedVersion) throw new ApiError(412, 'VERSION_CONFLICT', 'La reserva cambió. Volvé a consultar el enlace.');
      const now = this.clock.now();
      if (appointment.status !== 'CONFIRMED' || now >= appointment.startAt || appointment.startAt.getTime() - now.getTime() < appointment.publicCancelNoticeMinutesSnapshot * 60_000) {
        throw new ApiError(409, 'INVALID_APPOINTMENT_TRANSITION', 'La reserva ya no admite cancelación.');
      }
      const update = await tx.appointment.updateMany({ where: { id: appointment.id, organizationId: organization.id, version: expectedVersion, status: 'CONFIRMED' }, data: { status: 'CANCELLED', version: { increment: 1 }, updatedAt: now } });
      if (update.count !== 1) throw new ApiError(412, 'VERSION_CONFLICT', 'La reserva cambió. Volvé a consultar el enlace.');
      await tx.appointmentEvent.create({ data: {
        organizationId: organization.id, appointmentId: appointment.id, actorType: 'PUBLIC', action: 'CANCELLED', reasonCode: input.reasonCode,
        before: { status: appointment.status, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString(), version: appointment.version },
        after: { status: 'CANCELLED', startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString(), version: appointment.version + 1, changedAt: now.toISOString() },
      } });
      const after = { ...appointment, status: 'CANCELLED', version: appointment.version + 1 };
      return this.receipt(after);
    });
  }

  async reschedule(slug: string, appointmentId: string, input: PublicRescheduleDto, ifMatch: string | undefined) {
    const { organization, appointment } = await this.findByToken(slug, input.token);
    if (appointment.id !== appointmentId) throw tokenMissing();
    const context = { organizationId: organization.id, userId: '', membershipId: '', role: 'EMPLOYEE' as const };
    const result = await this.lifecycle.reschedule(context, appointmentId, ifMatch, input, { token: input.token, slug });
    return {
      id: result.id, status: result.status, startAt: result.startAt, endAt: result.endAt,
      durationMinutes: result.durationMinutes, serviceName: result.serviceNameSnapshot,
      staffName: result.staffNameSnapshot, timeZone: result.timezone, version: result.version,
    };
  }

  async revoke(context: TenantContext, appointmentId: string, ifMatch: string | undefined, input: RevokeManagementLinkDto) {
    if (context.role !== 'OWNER' && context.role !== 'ADMIN') throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para revocar enlaces.');
    const expectedVersion = parseIfMatch(ifMatch);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Appointment" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${appointmentId}::uuid FOR UPDATE`);
      const current = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
      if (!current) throw new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'No se encontró la reserva.');
      if (current.version !== expectedVersion) throw new ApiError(412, 'VERSION_CONFLICT', 'La reserva cambió desde la última lectura.');
      if (!current.managementTokenHash) throw new ApiError(409, 'MANAGEMENT_LINK_NOT_AVAILABLE', 'La reserva no tiene un enlace activo.');
      const now = this.clock.now();
      const update = await tx.appointment.updateMany({ where: { id: appointmentId, organizationId: context.organizationId, version: expectedVersion }, data: {
        managementTokenHash: null, managementTokenKeyVersion: null, managementTokenExpiresAt: null,
        managementTokenVersion: { increment: 1 }, version: { increment: 1 }, updatedAt: now,
      } });
      if (update.count !== 1) throw new ApiError(412, 'VERSION_CONFLICT', 'La reserva cambió desde la última lectura.');
      await tx.appointmentEvent.create({ data: {
        organizationId: context.organizationId, appointmentId, actorType: 'MEMBER', actorMembershipId: context.membershipId,
        action: 'MANAGEMENT_LINK_REVOKED', reasonCode: input.reasonCode,
        before: { managementLinkActive: true, version: current.version },
        after: { managementLinkActive: false, version: current.version + 1, changedAt: now.toISOString() },
      } });
      const after = { ...current, version: current.version + 1 };
      return { id: after.id, status: after.status, version: after.version, managementLinkActive: false };
    });
  }

  private async findByToken(slug: string, token: string) {
    const organization = await this.db.organization.findUnique({ where: { slug }, select: { id: true, timezone: true } });
    if (!organization) throw tokenMissing();
    const appointment = await this.db.appointment.findFirst({ where: { organizationId: organization.id, managementTokenHash: hashManagementToken(token), source: 'PUBLIC' } });
    if (!appointment || !this.tokenValid(appointment, token, slug)) throw tokenMissing();
    return { organization, appointment };
  }

  private tokenValid(appointment: {
    organizationId: string; id: string; source: string; managementTokenHash: string | null; managementTokenKeyVersion: number | null;
    managementTokenVersion: number; managementTokenExpiresAt: Date | null;
  }, token: string, _slug?: string): boolean {
    const now = this.clock.now();
    if (appointment.source !== 'PUBLIC' || !appointment.managementTokenHash || !appointment.managementTokenKeyVersion || !appointment.managementTokenExpiresAt || appointment.managementTokenExpiresAt <= now) return false;
    const secret = this.security.managementTokenSecretFor(appointment.managementTokenKeyVersion);
    if (!secret) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'La clave de gestión no está disponible temporalmente.');
    const derived = deriveManagementToken(secret, appointment.organizationId, appointment.id, appointment.managementTokenVersion);
    return derived === token && matchesManagementToken(token, appointment.managementTokenHash);
  }

  private receipt(value: { id: string; status: string; startAt: Date | string; endAt: Date | string; durationMinutes: number; serviceNameSnapshot: string; staffNameSnapshot: string | null; timezoneSnapshot: string; version: number }) {
    return {
      id: value.id, status: value.status,
      startAt: value.startAt instanceof Date ? value.startAt.toISOString() : value.startAt,
      endAt: value.endAt instanceof Date ? value.endAt.toISOString() : value.endAt,
      durationMinutes: value.durationMinutes, serviceName: value.serviceNameSnapshot, staffName: value.staffNameSnapshot,
      timeZone: value.timezoneSnapshot, version: value.version,
    };
  }

  private localDate(date: Date, timezone: string): string {
    return toLocalDateTime(date.toISOString(), timezone).date;
  }

  private async published(slug: string) {
    const organization = await this.db.organization.findUnique({ where: { slug }, select: { id: true, timezone: true } });
    if (!organization) throw missing();
    const settings = await this.db.schedulingSettings.findUnique({ where: { organizationId: organization.id } });
    const subscription = await this.db.subscription.findUnique({ where: { organizationId: organization.id } });
    if (!settings?.publicBookingEnabled || !validSubscription(subscription, this.clock.now())) throw missing();
    return { organization, settings };
  }

}
