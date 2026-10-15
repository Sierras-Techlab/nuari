import { Injectable } from '@nestjs/common';
import { randomUUID as cryptoRandomUUID } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../common/errors.js';
import { Clock } from '../common/clock.js';
import type { TenantContext } from '../organizations/tenant.guard.js';
import type { TransactionContext } from '../common/transaction.js';
import { PrismaService } from '../database/prisma.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service.js';
import { StaffServicesService } from '../staff/staff-services.service.js';
import { SchedulingReadService } from '../availability/scheduling-read.service.js';
import { computeAvailability, type AvailabilityCalendar, type AvailabilityStaffInput } from '../availability/availability-engine.js';
import { getLocalDayBounds, toLocalDateTime } from '../availability/time-zone-adapter.js';
import { SecurityConfig } from '../common/security.config.js';
import { bookingSubmissionDigests, type CanonicalBookingRequest } from './booking-submissions.js';
import type { CreateAppointmentDto } from './appointments.dto.js';
import type { PublicCreateAppointmentDto } from '../public-booking/public-booking.dto.js';
import { deriveManagementToken, hashManagementToken } from '../public-booking/management-token.js';
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../customers/customers.service.js';
import type { Subscription } from '../generated/prisma/client.js';

type AssignmentKind = 'SPECIFIC' | 'ANY' | 'NONE';

function notFound(): ApiError { return new ApiError(404, 'CUSTOMER_NOT_FOUND', 'No se encontró el cliente.'); }
function unavailable(): ApiError { return new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible. Actualizá la disponibilidad e intentá de nuevo.'); }
function configurationChanged(): ApiError { return new ApiError(409, 'BOOKING_CONFIGURATION_CHANGED', 'La configuración de reservas cambió. Actualizá la disponibilidad e intentá de nuevo.'); }

function evaluatePublicSubscription(subscription: Subscription, now: Date): boolean {
  if (subscription.status === 'TRIALING') return subscription.trialStartedAt <= now && now < subscription.trialEndsAt;
  return subscription.status === 'ACTIVE' && !!subscription.paidThrough && subscription.paidThrough > now;
}

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = Reflect.get(error, 'code');
  if (typeof code === 'string' && /^\d{5}$/.test(code)) return code;
  const meta = Reflect.get(error, 'meta');
  if (meta && typeof meta === 'object') {
    const metaCode = Reflect.get(meta, 'code');
    if (typeof metaCode === 'string' && /^\d{5}$/.test(metaCode)) return metaCode;
    const cause = Reflect.get(meta, 'cause');
    if (cause && typeof cause === 'object') {
      const causeCode = Reflect.get(cause, 'code');
      if (typeof causeCode === 'string' && /^\d{5}$/.test(causeCode)) return causeCode;
    }
  }
  return undefined;
}

function uniqueSubmission(error: unknown): boolean {
  if (!error || typeof error !== 'object' || Reflect.get(error, 'code') !== 'P2002') return false;
  const meta = Reflect.get(error, 'meta');
  return !!meta && typeof meta === 'object' && Reflect.get(meta, 'modelName') === 'BookingSubmission';
}

function mapCalendar(calendar: {
  weeklyWindows: Array<{ weekday: number; startMinute: number; endMinute: number }>;
  dayOverrides: Array<{ localDate: Date; windows: Array<{ startMinute: number; endMinute: number }> }>;
  timeOff: Array<{ startAt: Date; endAt: Date }>;
}): AvailabilityCalendar {
  return {
    weeklyWindows: calendar.weeklyWindows,
    dayOverrides: calendar.dayOverrides.map(item => ({ localDate: item.localDate.toISOString().slice(0, 10), windows: item.windows })),
    timeOff: calendar.timeOff,
  };
}

export function appointmentProjection(appointment: {
  id: string; organizationId: string; customerId: string; serviceId: string; staffMemberId: string | null;
  startAt: Date; endAt: Date; durationMinutes: number; assignmentKind: AssignmentKind; status: string;
  source: string; version: number; customerNameSnapshot: string; serviceNameSnapshot: string;
  staffNameSnapshot: string | null; timezoneSnapshot: string; internalNotes?: string | null;
}) {
  return {
    id: appointment.id, organizationId: appointment.organizationId, customerId: appointment.customerId,
    serviceId: appointment.serviceId, staffMemberId: appointment.staffMemberId,
    startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString(),
    durationMinutes: appointment.durationMinutes, assignmentKind: appointment.assignmentKind,
    status: appointment.status, source: appointment.source, version: appointment.version,
    customerNameSnapshot: appointment.customerNameSnapshot, serviceNameSnapshot: appointment.serviceNameSnapshot,
    staffNameSnapshot: appointment.staffNameSnapshot, timezone: appointment.timezoneSnapshot,
  };
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly customers: CustomersService,
    private readonly services: ServiceCatalogService,
    private readonly staffServices: StaffServicesService,
    private readonly schedulingRead: SchedulingReadService,
    private readonly clock: Clock,
    private readonly security: SecurityConfig,
  ) {}

  async createPublic(slug: string, idempotencyKey: string, input: PublicCreateAppointmentDto) {
    this.validateAssignmentShape(input.assignment.kind, input.assignment.staffMemberId);
    const name = input.customer.name.trim().normalize('NFC');
    const phone = input.customer.phone?.trim() || null;
    const email = normalizeCustomerEmail(input.customer.email);
    const phoneNormalized = normalizeCustomerPhone(phone);
    if (!name || (!phoneNormalized && !email)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ingresá tu nombre y al menos un teléfono o email válido.');
    }
    const startAt = this.parseStartAt(input.startAt);
    const canonical: CanonicalBookingRequest = {
      serviceId: input.serviceId,
      startAt,
      assignment: { kind: input.assignment.kind, ...(input.assignment.staffMemberId ? { staffMemberId: input.assignment.staffMemberId } : {}) },
      internalNotes: null,
      customer: { name, phone, email },
    };
    const digests = bookingSubmissionDigests(idempotencyKey, this.security.bookingSubmissionSecret, canonical, this.security.bookingSubmissionSecretVersion);
    const organization = await this.db.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!organization) throw this.publicUnavailable();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const existing = await this.db.bookingSubmission.findUnique({
          where: { organizationId_actorScope_keyHash: { organizationId: organization.id, actorScope: 'PUBLIC', keyHash: digests.keyHash } },
          include: { appointment: true },
        });
        if (existing) return this.replayPublic(existing, canonical);
        return await this.db.$transaction(async tx => this.createPublicInTransaction(tx, slug, organization.id, digests, canonical));
      } catch (error) {
        if (uniqueSubmission(error)) {
          const existing = await this.db.bookingSubmission.findUnique({
            where: { organizationId_actorScope_keyHash: { organizationId: organization.id, actorScope: 'PUBLIC', keyHash: digests.keyHash } },
            include: { appointment: true },
          });
          if (existing) return this.replayPublic(existing, canonical);
        }
        const code = postgresCode(error);
        if (code === '23P01') {
          if (canonical.assignment.kind === 'ANY' && attempt < 2) continue;
          throw unavailable();
        }
        if (code === '40P01' || code === '40001' || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) {
          if (attempt < 2) continue;
          throw new ApiError(503, 'BOOKING_BUSY', 'Hay mucha actividad en la agenda. Intentá de nuevo en unos segundos.', undefined, 2);
        }
        throw error;
      }
    }
    throw unavailable();
  }

  private async createPublicInTransaction(
    tx: TransactionContext, slug: string, organizationId: string,
    digests: ReturnType<typeof bookingSubmissionDigests>, input: CanonicalBookingRequest,
  ) {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${`PUBLIC:${digests.keyHash}`}))`);
    const replay = await tx.bookingSubmission.findUnique({
      where: { organizationId_actorScope_keyHash: { organizationId, actorScope: 'PUBLIC', keyHash: digests.keyHash } },
      include: { appointment: true },
    });
    if (replay) return this.replayPublic(replay, input);

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid AND "slug" = ${slug} FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT "organizationId" FROM "SchedulingSettings" WHERE "organizationId" = ${organizationId}::uuid FOR SHARE`);
    const [organization, settings, subscription] = await Promise.all([
      tx.organization.findFirst({ where: { id: organizationId, slug }, select: { id: true, timezone: true } }),
      tx.schedulingSettings.findUnique({ where: { organizationId } }),
      tx.subscription.findUnique({ where: { organizationId } }),
    ]);
    if (!organization || !settings?.publicBookingEnabled || !subscription || !evaluatePublicSubscription(subscription, this.clock.now())) throw this.publicUnavailable();

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Service" WHERE "organizationId" = ${organizationId}::uuid AND "id" = ${input.serviceId}::uuid FOR SHARE`);
    const publishedService = await tx.service.findFirst({ where: { id: input.serviceId, organizationId, active: true, publicBookable: true }, select: { id: true } });
    if (!publishedService) throw this.publicUnavailable();
    const service = await this.services.getBookableService({ organizationId }, input.serviceId, tx);
    this.assertAssignmentMode(service.staffSelectionMode, input.assignment.kind, input.assignment.staffMemberId);

    const instant = Temporal.Instant.from(input.startAt);
    const local = toLocalDateTime(input.startAt, organization.timezone);
    const now = this.clock.now();
    const localToday = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(organization.timezone).toPlainDate();
    const localStartDate = Temporal.PlainDate.from(local.date);
    if (instant.epochMilliseconds < now.getTime() + settings.publicMinNoticeMinutes * 60_000 ||
      Temporal.PlainDate.compare(localStartDate, localToday.add({ days: settings.publicMaxAdvanceDays })) > 0) throw unavailable();
    if ((Number(local.time.slice(0, 2)) * 60 + Number(local.time.slice(3, 5))) % settings.slotStepMinutes !== 0 || instant.epochNanoseconds % 60_000_000_000n !== 0n) throw unavailable();
    const dayBounds = getLocalDayBounds(local.date, organization.timezone);
    if (!dayBounds) throw unavailable();
    if (input.assignment.kind !== 'NONE') await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${local.date}))`);
    else await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${`NO_ASSIGNMENT:${service.id}:${local.date}`}))`);

    const eligible = input.assignment.kind === 'NONE' ? [] : await this.staffServices.listEligibleStaff({ organizationId }, service.id, tx);
    const staffToLock = input.assignment.kind === 'SPECIFIC' ? [input.assignment.staffMemberId!] : eligible.map(item => item.id);
    for (const staffId of [...new Set(staffToLock)].sort()) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "StaffMember" WHERE "organizationId" = ${organizationId}::uuid AND "id" = ${staffId}::uuid FOR SHARE`);
    }
    const staffIds = input.assignment.kind === 'SPECIFIC' ? [input.assignment.staffMemberId!] : eligible.map(item => item.id);
    const calendars = await tx.bookingCalendar.findMany({
      where: { organizationId, OR: [{ kind: 'BUSINESS' }, ...(staffIds.length ? [{ staffMemberId: { in: staffIds } }] : [])] },
      select: { id: true }, orderBy: { id: 'asc' },
    });
    for (const calendar of calendars) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "BookingCalendar" WHERE "organizationId" = ${organizationId}::uuid AND "id" = ${calendar.id}::uuid FOR SHARE`);
    const calendarRows = await tx.bookingCalendar.findMany({
      where: { organizationId, id: { in: calendars.map(item => item.id) } },
      include: {
        weeklyWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
        dayOverrides: { where: { localDate: new Date(`${local.date}T00:00:00.000Z`) }, include: { windows: { orderBy: { startMinute: 'asc' } } } },
        timeOff: { where: { startAt: { lt: new Date(Date.parse(input.startAt) + service.durationMinutes * 60_000) }, endAt: { gt: new Date(input.startAt) } }, select: { startAt: true, endAt: true } },
      },
    });
    const business = calendarRows.find(item => item.kind === 'BUSINESS');
    const businessCalendar = business ? mapCalendar(business) : null;
    const byStaff = new Map(calendarRows.filter(item => item.kind === 'STAFF' && item.staffMemberId).map(item => [item.staffMemberId!, mapCalendar(item)]));
    const staff: AvailabilityStaffInput[] = eligible.map(item => ({ id: item.id, name: item.name, calendar: byStaff.get(item.id) ?? null }));
    const resources = service.staffSelectionMode === 'NO_ASSIGNMENT' ? [{ kind: 'SERVICE' as const, serviceId: service.id }] : eligible.map(item => ({ kind: 'STAFF' as const, staffMemberId: item.id }));
    const endAt = new Date(Date.parse(input.startAt) + service.durationMinutes * 60_000);
    const busy = await this.schedulingRead.loadBusyIntervals({ organizationId }, resources, { startAt: new Date(input.startAt), endAt }, tx);
    const availability = computeAvailability({
      service: { id: service.id, durationMinutes: service.durationMinutes, staffSelectionMode: service.staffSelectionMode },
      businessCalendar, staff, busyIntervals: busy,
      selection: input.assignment.kind === 'SPECIFIC' ? { kind: 'SPECIFIC', staffMemberId: input.assignment.staffMemberId! } : input.assignment.kind === 'ANY' ? { kind: 'ANY' } : { kind: 'NONE' },
      fromDate: local.date, toDate: Temporal.PlainDate.from(local.date).add({ days: 1 }).toString(),
      timeZone: organization.timezone, slotStepMinutes: settings.slotStepMinutes, now: new Date(now.getTime() + settings.publicMinNoticeMinutes * 60_000).toISOString(), at: input.startAt, limit: 1,
    });
    const slot = availability.slots[0];
    if (!slot) throw unavailable();
    let staffMemberId: string | null = null;
    let staffNameSnapshot: string | null = null;
    let assignmentKind = input.assignment.kind;
    if (input.assignment.kind === 'SPECIFIC') {
      const selected = slot.staff.find(item => item.id === input.assignment.staffMemberId);
      if (!selected) throw unavailable();
      staffMemberId = selected.id; staffNameSnapshot = selected.name;
    } else if (input.assignment.kind === 'ANY') {
      if (!slot.staff.length) throw unavailable();
      const counts = await tx.appointment.groupBy({
        by: ['staffMemberId'], where: { organizationId, staffMemberId: { in: slot.staff.map(item => item.id) }, status: { in: ['CONFIRMED', 'COMPLETED'] }, startAt: { gte: dayBounds.startAt, lt: dayBounds.endAt } }, _count: { _all: true },
      });
      const countMap = new Map(counts.map(item => [item.staffMemberId!, item._count._all]));
      const chosen = [...slot.staff].sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0) || a.id.localeCompare(b.id))[0]!;
      staffMemberId = chosen.id; staffNameSnapshot = chosen.name;
    } else assignmentKind = 'NONE';

    const guest = input.customer!;
    const customer = await tx.customer.create({ data: {
      organizationId, name: guest.name, phone: guest.phone, phoneNormalized: normalizeCustomerPhone(guest.phone),
      email: guest.email, active: true, version: 1, createdAt: now, updatedAt: now,
    } });
    const managementTokenVersion = 1;
    const tokenSecret = this.security.managementTokenSecretFor(managementTokenVersion);
    if (!tokenSecret) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'La clave de gestión no está disponible temporalmente.');
    // Appointment ID is generated explicitly so the one-time capability can be derived before insert.
    const appointmentId = cryptoRandomUUID();
    const actualToken = deriveManagementToken(tokenSecret, organizationId, appointmentId, managementTokenVersion);
    const expiresAt = new Date(endAt.getTime() + 30 * 24 * 60 * 60_000);
    const appointment = await tx.appointment.create({ data: {
      id: appointmentId, organizationId, customerId: customer.id, serviceId: service.id, staffMemberId,
      startAt: new Date(input.startAt), endAt, durationMinutes: service.durationMinutes,
      schedulingPolicyVersion: settings.version, slotStepMinutesSnapshot: settings.slotStepMinutes,
      publicMinNoticeMinutesSnapshot: settings.publicMinNoticeMinutes, publicMaxAdvanceDaysSnapshot: settings.publicMaxAdvanceDays,
      publicCancelNoticeMinutesSnapshot: settings.publicCancelNoticeMinutes, timezoneSnapshot: organization.timezone,
      serviceSelectionModeSnapshot: service.staffSelectionMode, assignmentKind,
      customerNameSnapshot: guest.name, customerPhoneSnapshot: guest.phone, customerEmailSnapshot: guest.email,
      serviceNameSnapshot: service.name, staffNameSnapshot, source: 'PUBLIC', createdByMembershipId: null,
      managementTokenHash: hashManagementToken(actualToken), managementTokenKeyVersion: managementTokenVersion,
      managementTokenVersion, managementTokenExpiresAt: expiresAt,
    } });
    await tx.appointmentEvent.create({ data: {
      organizationId, appointmentId: appointment.id, actorType: 'PUBLIC', action: 'CREATED',
      after: { status: 'CONFIRMED', startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString(), assignmentKind, staffMemberId },
    } });
    await tx.bookingSubmission.create({ data: {
      organizationId, actorScope: 'PUBLIC', keyHash: digests.keyHash, requestHash: digests.requestHash,
      requestHashKeyVersion: digests.requestHashKeyVersion, appointmentId: appointment.id,
    } });
    return this.publicProjection(appointment, actualToken);
  }

  private replayPublic(submission: { requestHash: string; requestHashKeyVersion: number; appointment: Parameters<typeof appointmentProjection>[0] & {
    managementTokenHash?: string | null; managementTokenKeyVersion?: number | null; managementTokenVersion?: number; managementTokenExpiresAt?: Date | null;
  } }, input: CanonicalBookingRequest) {
    const secret = this.security.bookingSubmissionSecretFor(submission.requestHashKeyVersion);
    if (!secret) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'La clave de idempotencia no está disponible temporalmente.');
    if (submission.requestHash !== bookingSubmissionDigests('', secret, input, submission.requestHashKeyVersion).requestHash) {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'La clave de idempotencia ya se usó con otra solicitud.');
    }
    let token: string | undefined;
    const row = submission.appointment;
    if (row.managementTokenHash && row.managementTokenKeyVersion && row.managementTokenExpiresAt && row.managementTokenExpiresAt > this.clock.now()) {
      const tokenSecret = this.security.managementTokenSecretFor(row.managementTokenKeyVersion);
      if (!tokenSecret) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'La clave de gestión no está disponible temporalmente.');
      const candidate = deriveManagementToken(tokenSecret, row.organizationId, row.id, row.managementTokenVersion ?? 1);
      if (hashManagementToken(candidate) === row.managementTokenHash) token = candidate;
    }
    return this.publicProjection(row, token);
  }

  private publicProjection(appointment: Parameters<typeof appointmentProjection>[0], managementToken?: string) {
    return {
      id: appointment.id, status: appointment.status, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString(),
      durationMinutes: appointment.durationMinutes, serviceName: appointment.serviceNameSnapshot, staffName: appointment.staffNameSnapshot,
      timeZone: appointment.timezoneSnapshot, version: appointment.version,
      ...(managementToken ? { managementToken } : {}),
    };
  }

  private publicUnavailable(): ApiError { return new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.'); }

  async createInternal(context: TenantContext, idempotencyKey: string, input: CreateAppointmentDto) {
    this.validateAssignmentShape(input.assignment.kind, input.assignment.staffMemberId);
    if (context.role === 'EMPLOYEE' && input.internalNotes !== undefined) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para agregar notas internas a la reserva.');
    }
    const startAt = this.parseStartAt(input.startAt);
    const assignment = { kind: input.assignment.kind, ...(input.assignment.staffMemberId ? { staffMemberId: input.assignment.staffMemberId } : {}) } as CanonicalBookingRequest['assignment'];
    const canonical: CanonicalBookingRequest = {
      customerId: input.customerId,
      serviceId: input.serviceId,
      startAt,
      assignment,
      internalNotes: input.internalNotes?.trim() || null,
    };
    const digests = bookingSubmissionDigests(idempotencyKey, this.security.bookingSubmissionSecret, canonical, this.security.bookingSubmissionSecretVersion);
    const actorScope = `MEMBER:${context.membershipId}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const existing = await this.db.bookingSubmission.findUnique({
          where: { organizationId_actorScope_keyHash: { organizationId: context.organizationId, actorScope, keyHash: digests.keyHash } },
          include: { appointment: true },
        });
        if (existing) return this.replay(existing, canonical);

        return await this.db.$transaction(async tx => this.createInTransaction(tx, context, actorScope, digests, canonical));
      } catch (error) {
        if (uniqueSubmission(error)) {
          const existing = await this.db.bookingSubmission.findUnique({
            where: { organizationId_actorScope_keyHash: { organizationId: context.organizationId, actorScope, keyHash: digests.keyHash } },
            include: { appointment: true },
          });
          if (existing) return this.replay(existing, canonical);
        }
        const code = postgresCode(error);
        if (code === '23P01') {
          if (canonical.assignment.kind === 'ANY' && attempt < 2) continue;
          throw unavailable();
        }
        if (code === '40P01' || code === '40001' || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) {
          if (attempt < 2) continue;
          throw new ApiError(503, 'BOOKING_BUSY', 'Hay mucha actividad en la agenda. Intentá de nuevo en unos segundos.', undefined, 2);
        }
        throw error;
      }
    }
    throw unavailable();
  }

  private async createInTransaction(
    tx: TransactionContext,
    context: TenantContext,
    actorScope: string,
    digests: ReturnType<typeof bookingSubmissionDigests>,
    input: CanonicalBookingRequest,
  ) {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${context.organizationId}), hashtext(${`${actorScope}:${digests.keyHash}`}))`);
    const replay = await tx.bookingSubmission.findUnique({
      where: { organizationId_actorScope_keyHash: { organizationId: context.organizationId, actorScope, keyHash: digests.keyHash } },
      include: { appointment: true },
    });
    if (replay) return this.replay(replay, input);

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId}::uuid FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT "organizationId" FROM "SchedulingSettings" WHERE "organizationId" = ${context.organizationId}::uuid FOR SHARE`);
    const organization = await tx.organization.findUnique({ where: { id: context.organizationId }, select: { timezone: true } });
    if (!organization) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
    const settings = await tx.schedulingSettings.findUnique({ where: { organizationId: context.organizationId } });
    if (!settings) throw configurationChanged();

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Service" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${input.serviceId}::uuid FOR SHARE`);
    const service = await this.services.getBookableService({ organizationId: context.organizationId }, input.serviceId, tx);
    this.assertAssignmentMode(service.staffSelectionMode, input.assignment.kind, input.assignment.staffMemberId);

    const instant = Temporal.Instant.from(input.startAt);
    const local = toLocalDateTime(input.startAt, organization.timezone);
    const now = this.clock.now();
    const localToday = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(organization.timezone).toPlainDate();
    const localStartDate = Temporal.PlainDate.from(local.date);
    if (Temporal.Instant.compare(instant, Temporal.Instant.from(now.toISOString())) < 0 ||
      Temporal.PlainDate.compare(localStartDate, localToday.add({ days: 365 })) > 0) throw unavailable();
    if ((Number(local.time.slice(0, 2)) * 60 + Number(local.time.slice(3, 5))) % settings.slotStepMinutes !== 0) throw unavailable();
    if (instant.epochNanoseconds % 60_000_000_000n !== 0n) throw unavailable();
    const dayBounds = getLocalDayBounds(local.date, organization.timezone);
    if (!dayBounds) throw unavailable();
    if (input.assignment.kind !== 'NONE') {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${context.organizationId}), hashtext(${local.date}))`);
    } else {
      const capacityKey = `NO_ASSIGNMENT:${input.serviceId}:${local.date}`;
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${context.organizationId}), hashtext(${capacityKey}))`);
    }

    // Service → Staff → Customer → Calendar follows the shared booking lock order.
    const eligible = input.assignment.kind === 'NONE'
      ? []
      : await this.staffServices.listEligibleStaff({ organizationId: context.organizationId }, service.id, tx);
    const lockedStaffIds = input.assignment.kind === 'SPECIFIC'
      ? [input.assignment.staffMemberId!]
      : eligible.map(item => item.id);
    for (const staffMemberId of [...new Set(lockedStaffIds)].sort()) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "StaffMember" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${staffMemberId}::uuid FOR SHARE`);
    }

    const customer = await this.lockAndLoadCustomer(tx, context.organizationId, input.customerId!);
    const staffIdsForCalendars = input.assignment.kind === 'SPECIFIC' ? [input.assignment.staffMemberId!] : eligible.map(item => item.id);
    const calendars = await tx.bookingCalendar.findMany({
      where: {
        organizationId: context.organizationId,
        OR: [{ kind: 'BUSINESS' }, ...(staffIdsForCalendars.length ? [{ staffMemberId: { in: staffIdsForCalendars } }] : [])],
      },
      select: { id: true, kind: true, staffMemberId: true },
      orderBy: { id: 'asc' },
    });
    for (const calendar of calendars) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "BookingCalendar" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${calendar.id}::uuid FOR SHARE`);
    }

    const calendarRows = await tx.bookingCalendar.findMany({
      where: { id: { in: calendars.map(item => item.id) }, organizationId: context.organizationId },
      include: {
        weeklyWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
        dayOverrides: { where: { localDate: new Date(`${local.date}T00:00:00.000Z`) }, include: { windows: { orderBy: { startMinute: 'asc' } } } },
        timeOff: { where: { startAt: { lt: new Date(Date.parse(input.startAt) + service.durationMinutes * 60_000) }, endAt: { gt: new Date(input.startAt) } }, select: { startAt: true, endAt: true } },
      },
    });
    const business = calendarRows.find(item => item.kind === 'BUSINESS');
    const businessCalendar = business ? mapCalendar(business) : null;
    const calendarByStaff = new Map(calendarRows.filter(item => item.kind === 'STAFF' && item.staffMemberId).map(item => [item.staffMemberId!, mapCalendar(item)]));
    const staff: AvailabilityStaffInput[] = eligible.map(item => ({ id: item.id, name: item.name, calendar: calendarByStaff.get(item.id) ?? null }));
    const resources = service.staffSelectionMode === 'NO_ASSIGNMENT'
      ? [{ kind: 'SERVICE' as const, serviceId: service.id }]
      : eligible.map(item => ({ kind: 'STAFF' as const, staffMemberId: item.id }));
    const endAt = new Date(Date.parse(input.startAt) + service.durationMinutes * 60_000);
    const busyIntervals = await this.schedulingRead.loadBusyIntervals(
      { organizationId: context.organizationId }, resources, { startAt: new Date(input.startAt), endAt }, tx,
    );
    const availability = computeAvailability({
      service: { id: service.id, durationMinutes: service.durationMinutes, staffSelectionMode: service.staffSelectionMode },
      businessCalendar, staff, busyIntervals,
      selection: input.assignment.kind === 'SPECIFIC'
        ? { kind: 'SPECIFIC', staffMemberId: input.assignment.staffMemberId! }
        : input.assignment.kind === 'ANY' ? { kind: 'ANY' } : { kind: 'NONE' },
      fromDate: local.date, toDate: Temporal.PlainDate.from(local.date).add({ days: 1 }).toString(),
      timeZone: organization.timezone, slotStepMinutes: settings.slotStepMinutes, now: now.toISOString(), at: input.startAt, limit: 1,
    });
    const slot = availability.slots[0];
    if (!slot) throw unavailable();

    let staffMemberId: string | null = null;
    let staffNameSnapshot: string | null = null;
    let assignmentKind = input.assignment.kind;
    if (input.assignment.kind === 'SPECIFIC') {
      const selected = slot.staff.find(item => item.id === input.assignment.staffMemberId);
      if (!selected) throw unavailable();
      staffMemberId = selected.id;
      staffNameSnapshot = selected.name;
    } else if (input.assignment.kind === 'ANY') {
      if (slot.staff.length === 0) throw unavailable();
      const counts = await tx.appointment.groupBy({
        by: ['staffMemberId'],
        where: {
          organizationId: context.organizationId, staffMemberId: { in: slot.staff.map(item => item.id) },
          status: { in: ['CONFIRMED', 'COMPLETED'] }, startAt: { gte: dayBounds.startAt, lt: dayBounds.endAt },
        },
        _count: { _all: true },
      });
      const countByStaff = new Map(counts.map(item => [item.staffMemberId!, item._count._all]));
      const chosen = [...slot.staff].sort((left, right) => {
        const countDifference = (countByStaff.get(left.id) ?? 0) - (countByStaff.get(right.id) ?? 0);
        if (countDifference !== 0) return countDifference;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      })[0]!;
      staffMemberId = chosen.id;
      staffNameSnapshot = chosen.name;
    } else {
      assignmentKind = 'NONE';
    }

    const appointment = await tx.appointment.create({
      data: {
        organizationId: context.organizationId, customerId: customer.id, serviceId: service.id, staffMemberId,
        startAt: new Date(input.startAt), endAt, durationMinutes: service.durationMinutes,
        schedulingPolicyVersion: settings.version, slotStepMinutesSnapshot: settings.slotStepMinutes,
        publicMinNoticeMinutesSnapshot: settings.publicMinNoticeMinutes,
        publicMaxAdvanceDaysSnapshot: settings.publicMaxAdvanceDays,
        publicCancelNoticeMinutesSnapshot: settings.publicCancelNoticeMinutes,
        timezoneSnapshot: organization.timezone, serviceSelectionModeSnapshot: service.staffSelectionMode,
        assignmentKind, customerNameSnapshot: customer.name, customerPhoneSnapshot: customer.phone,
        customerEmailSnapshot: customer.email, serviceNameSnapshot: service.name, staffNameSnapshot,
        source: 'MEMBER', createdByMembershipId: context.membershipId, internalNotes: input.internalNotes,
      },
    });
    await tx.appointmentEvent.create({
      data: {
        organizationId: context.organizationId, appointmentId: appointment.id, actorType: 'MEMBER',
        actorMembershipId: context.membershipId, action: 'CREATED',
        after: { status: 'CONFIRMED', startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString(), assignmentKind, staffMemberId },
      },
    });
    await tx.bookingSubmission.create({
      data: {
        organizationId: context.organizationId, actorScope, keyHash: digests.keyHash,
        requestHash: digests.requestHash, requestHashKeyVersion: digests.requestHashKeyVersion,
        appointmentId: appointment.id,
      },
    });
    return appointmentProjection(appointment);
  }

  private async lockAndLoadCustomer(tx: TransactionContext, organizationId: string, customerId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Customer" WHERE "organizationId" = ${organizationId}::uuid AND "id" = ${customerId}::uuid FOR SHARE`);
    const customer = await this.customers.getBookableCustomer({ organizationId }, customerId, tx);
    if (!customer.active) throw notFound();
    return customer;
  }

  private replay(submission: { requestHash: string; requestHashKeyVersion: number; appointment: Parameters<typeof appointmentProjection>[0] }, input: CanonicalBookingRequest) {
    const secret = this.security.bookingSubmissionSecretFor(submission.requestHashKeyVersion);
    if (!secret) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'La clave de idempotencia no está disponible temporalmente.');
    const requestHash = bookingSubmissionDigests('', secret, input, submission.requestHashKeyVersion).requestHash;
    if (submission.requestHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'La clave de idempotencia ya se usó con otra solicitud.');
    return appointmentProjection(submission.appointment);
  }

  private parseStartAt(value: string): string {
    try {
      const instant = Temporal.Instant.from(value);
      if (instant.epochNanoseconds % 60_000_000_000n !== 0n) throw new RangeError();
      return instant.toString({ smallestUnit: 'millisecond' });
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'El inicio debe ser un instante válido, con offset explícito y alineado a minutos.');
    }
  }

  private validateAssignmentShape(kind: AssignmentKind, staffMemberId?: string): void {
    if ((kind === 'SPECIFIC') !== (staffMemberId !== undefined)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'staffMemberId sólo se admite y es obligatorio para SPECIFIC.');
    }
  }

  private assertAssignmentMode(mode: string, kind: AssignmentKind, staffMemberId?: string): void {
    if ((mode === 'NO_ASSIGNMENT' && kind !== 'NONE') || (mode === 'AUTO_ASSIGN' && kind !== 'ANY') ||
      (mode === 'CUSTOMER_CHOICE' && kind === 'NONE') || (mode !== 'CUSTOMER_CHOICE' && staffMemberId !== undefined)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'La asignación solicitada no corresponde al modo del servicio.');
    }
  }
}
