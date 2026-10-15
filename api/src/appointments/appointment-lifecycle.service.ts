import { Injectable } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../common/errors.js';
import { Clock } from '../common/clock.js';
import { parseIfMatch } from '../common/if-match.js';
import type { TransactionContext } from '../common/transaction.js';
import type { TenantContext } from '../organizations/tenant.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { getLocalDayBounds, toLocalDateTime } from '../availability/time-zone-adapter.js';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service.js';
import { StaffServicesService } from '../staff/staff-services.service.js';
import { SchedulingReadService } from '../availability/scheduling-read.service.js';
import { computeAvailability, type AvailabilityCalendar, type AvailabilityStaffInput } from '../availability/availability-engine.js';
import { appointmentProjection } from './appointments.service.js';
import type { AppointmentListQueryDto, AppointmentTransitionDto, CorrectAppointmentDto, RescheduleAppointmentDto } from './appointments.dto.js';
import { SecurityConfig } from '../common/security.config.js';
import { deriveManagementToken, matchesManagementToken } from '../public-booking/management-token.js';

type Status = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

function notFound(): ApiError { return new ApiError(404, 'APPOINTMENT_NOT_FOUND', 'No se encontró la reserva.'); }
function invalidTransition(): ApiError { return new ApiError(409, 'INVALID_APPOINTMENT_TRANSITION', 'La reserva no admite esa transición en este momento.'); }
function date(value: string): Temporal.PlainDate {
  try {
    const parsed = Temporal.PlainDate.from(value, { overflow: 'reject' });
    if (parsed.toString() !== value) throw new RangeError();
    return parsed;
  } catch { throw new ApiError(400, 'VALIDATION_ERROR', 'La fecha local no es válida.'); }
}

function dayStart(dateValue: Temporal.PlainDate, timeZone: string): Date {
  for (let offset = 0; offset <= 370; offset += 1) {
    const bounds = getLocalDayBounds(dateValue.add({ days: offset }).toString(), timeZone);
    if (bounds) return bounds.startAt;
  }
  throw new ApiError(400, 'INVALID_TIME_ZONE', 'No se pudo resolver el límite de fecha para la zona horaria.');
}

function validStatus(value: unknown): value is Status {
  return value === 'CONFIRMED' || value === 'COMPLETED' || value === 'CANCELLED' || value === 'NO_SHOW';
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

@Injectable()
export class AppointmentLifecycleService {
  constructor(
    private readonly db: PrismaService,
    private readonly clock: Clock,
    private readonly services: ServiceCatalogService,
    private readonly staffServices: StaffServicesService,
    private readonly schedulingRead: SchedulingReadService,
    private readonly security: SecurityConfig,
  ) {}

  async list(context: TenantContext, query: AppointmentListQueryDto) {
    const from = date(query.fromDate);
    const to = date(query.toDate);
    const days = from.until(to, { largestUnit: 'day' }).days;
    if (days < 1 || days > 31) throw new ApiError(400, 'VALIDATION_ERROR', 'Consultá entre uno y 31 días locales.');
    const organization = await this.db.organization.findUnique({ where: { id: context.organizationId }, select: { timezone: true } });
    if (!organization) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
    const startAt = dayStart(from, organization.timezone);
    const endAt = dayStart(to, organization.timezone);
    const cursor = this.decodeCursor(query.cursor, query, context.organizationId);
    const rows = await this.db.appointment.findMany({
      where: {
        organizationId: context.organizationId,
        startAt: { lt: endAt }, endAt: { gt: startAt },
        ...(query.status ? { status: query.status } : {}),
        ...(query.staffMemberId ? { staffMemberId: query.staffMemberId } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(cursor ? { OR: [{ startAt: { gt: new Date(cursor.startAt) } }, { startAt: new Date(cursor.startAt), id: { gt: cursor.id } }] } : {}),
      },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }], take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map(appointmentProjection);
    return {
      items,
      pageInfo: {
        limit: query.limit, hasMore,
        nextCursor: hasMore && items.length ? this.encodeCursor(items.at(-1)!, query, context.organizationId) : null,
      },
      timeZone: organization.timezone,
    };
  }

  async get(context: TenantContext, appointmentId: string) {
    const appointment = await this.db.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
    if (!appointment) throw notFound();
    return {
      ...appointmentProjection(appointment),
      ...(context.role === 'OWNER' || context.role === 'ADMIN' ? { internalNotes: appointment.internalNotes } : {}),
    };
  }

  async events(context: TenantContext, appointmentId: string) {
    const exists = await this.db.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId }, select: { id: true } });
    if (!exists) throw notFound();
    const rows = await this.db.appointmentEvent.findMany({
      where: { organizationId: context.organizationId, appointmentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, actorType: true, action: true, reasonCode: true, before: true, after: true, createdAt: true },
    });
    return rows.map(row => ({ ...row, reasonCode: context.role === 'OWNER' || context.role === 'ADMIN' ? row.reasonCode : null }));
  }

  async cancel(context: TenantContext, appointmentId: string, ifMatch: string | undefined, input: AppointmentTransitionDto) {
    return this.transition(context, appointmentId, ifMatch, 'CANCELLED', 'CANCELLED', input.reasonCode);
  }

  async close(context: TenantContext, appointmentId: string, ifMatch: string | undefined, status: 'COMPLETED' | 'NO_SHOW') {
    if (context.role !== 'OWNER' && context.role !== 'ADMIN') throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para cerrar reservas.');
    return this.transition(context, appointmentId, ifMatch, status, status);
  }

  async correct(context: TenantContext, appointmentId: string, ifMatch: string | undefined, input: CorrectAppointmentDto) {
    if (context.role !== 'OWNER' && context.role !== 'ADMIN') throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para corregir reservas.');
    if (!validStatus(input.status)) throw new ApiError(400, 'VALIDATION_ERROR', 'El estado de destino no es válido.');
    const expectedVersion = parseIfMatch(ifMatch);
    return this.db.$transaction(async tx => {
      const current = await this.lockAppointmentParents(tx, context, appointmentId);
      if (current.version !== expectedVersion) throw this.versionConflict();
      if (current.status === 'CONFIRMED' || current.status === input.status) throw invalidTransition();
      const now = this.clock.now();
      if ((input.status === 'COMPLETED' || input.status === 'NO_SHOW') && current.status === 'CANCELLED' && now < current.endAt) throw invalidTransition();
      if (input.status !== 'CANCELLED') {
        await this.assertRestorable(tx, context.organizationId, current, input.status === 'CONFIRMED');
      }
      if (input.status === 'CONFIRMED') {
        if (current.startAt <= now) throw invalidTransition();
      }
      const updated = await tx.appointment.updateMany({
        where: { id: appointmentId, organizationId: context.organizationId, version: expectedVersion },
        data: { status: input.status, version: { increment: 1 }, updatedAt: now },
      });
      if (updated.count !== 1) throw this.versionConflict();
      await this.writeEvent(tx, context, current, 'CORRECTED', input.reasonCode, input.status, now);
      const after = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
      if (!after) throw notFound();
      return appointmentProjection(after);
    });
  }

  async reschedule(context: TenantContext, appointmentId: string, ifMatch: string | undefined, input: RescheduleAppointmentDto, publicAccess?: { token: string; slug: string }) {
    const expectedVersion = parseIfMatch(ifMatch);
    let requestedStart: Temporal.Instant;
    try {
      requestedStart = Temporal.Instant.from(input.startAt);
      if (requestedStart.epochNanoseconds % 60_000_000_000n !== 0n) throw new RangeError();
    } catch { throw new ApiError(400, 'VALIDATION_ERROR', 'El inicio debe ser un instante válido, con offset explícito y alineado a minutos.'); }
    const requestedStartAt = new Date(Number(requestedStart.epochMilliseconds));

    return this.db.$transaction(async tx => {
      const initial = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
      if (!initial) throw notFound();
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId}::uuid FOR SHARE`);
      await tx.$queryRaw(Prisma.sql`SELECT "organizationId" FROM "SchedulingSettings" WHERE "organizationId" = ${context.organizationId}::uuid FOR SHARE`);
      const organization = await tx.organization.findUnique({ where: { id: context.organizationId }, select: { timezone: true, slug: true } });
      const settings = await tx.schedulingSettings.findUnique({ where: { organizationId: context.organizationId } });
      if (!organization || !settings) throw notFound();
      const now = this.clock.now();
      if (publicAccess) {
        if (organization.slug !== publicAccess.slug || initial.source !== 'PUBLIC' || !this.validManagementToken(initial, publicAccess.token, now)) throw notFound();
        const subscription = await tx.subscription.findUnique({ where: { organizationId: context.organizationId } });
        const publicEnabled = settings.publicBookingEnabled && !!subscription &&
          (subscription.status === 'TRIALING' ? subscription.trialStartedAt <= now && now < subscription.trialEndsAt : subscription.status === 'ACTIVE' && !!subscription.paidThrough && subscription.paidThrough > now);
        if (!publicEnabled) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
      }
      if (initial.status !== 'CONFIRMED' || initial.startAt <= now) throw invalidTransition();
      if (initial.startAt.getTime() - now.getTime() < initial.publicCancelNoticeMinutesSnapshot * 60_000) throw invalidTransition();

      const local = toLocalDateTime(requestedStartAt.toISOString(), organization.timezone);
      const localToday = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(organization.timezone).toPlainDate();
      const localDate = Temporal.PlainDate.from(local.date);
      const maxAdvance = publicAccess ? settings.publicMaxAdvanceDays : 365;
      const earliest = publicAccess ? now.getTime() + settings.publicMinNoticeMinutes * 60_000 : now.getTime();
      if (requestedStartAt.getTime() < earliest || Temporal.PlainDate.compare(localDate, localToday.add({ days: maxAdvance })) > 0 ||
        (Number(local.time.slice(0, 2)) * 60 + Number(local.time.slice(3, 5))) % settings.slotStepMinutes !== 0) throw invalidTransition();
      if (requestedStartAt.getTime() === initial.startAt.getTime() && input.assignment.kind === initial.assignmentKind &&
        input.assignment.staffMemberId === initial.staffMemberId) throw new ApiError(400, 'VALIDATION_ERROR', 'La reserva ya ocupa ese horario y asignación.');

      const sourceLocalDate = toLocalDateTime(initial.startAt.toISOString(), organization.timezone).date;
      const coordinationKeys = [...new Set([
        initial.staffMemberId ? sourceLocalDate : `NO_ASSIGNMENT:${initial.serviceId}:${sourceLocalDate}`,
        input.assignment.kind === 'NONE' ? `NO_ASSIGNMENT:${initial.serviceId}:${local.date}` : local.date,
      ])].sort();
      for (const key of coordinationKeys) {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${context.organizationId}), hashtext(${key}))`);
      }

      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Service" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${initial.serviceId}::uuid FOR SHARE`);
      const service = await this.services.getBookableService({ organizationId: context.organizationId }, initial.serviceId, tx);
      if (publicAccess && !service.publicBookable) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
      if (service.staffSelectionMode !== initial.serviceSelectionModeSnapshot) {
        throw new ApiError(409, 'BOOKING_CONFIGURATION_CHANGED', 'El modo del servicio cambió. Cancelá y creá una reserva nueva.');
      }
      const kind = input.assignment.kind;
      const staffMemberId = input.assignment.staffMemberId;
      if ((kind === 'SPECIFIC') !== (staffMemberId !== undefined) ||
        (service.staffSelectionMode === 'NO_ASSIGNMENT' && kind !== 'NONE') ||
        (service.staffSelectionMode === 'AUTO_ASSIGN' && kind !== 'ANY') ||
        (service.staffSelectionMode === 'CUSTOMER_CHOICE' && kind === 'NONE')) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'La asignación solicitada no corresponde al modo del servicio.');
      }

      const eligible = kind === 'NONE' ? [] : await this.staffServices.listEligibleStaff({ organizationId: context.organizationId }, service.id, tx);
      const lockedStaffIds = kind === 'SPECIFIC' ? [staffMemberId!] : eligible.map(item => item.id);
      for (const id of [...new Set(lockedStaffIds)].sort()) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "StaffMember" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${id}::uuid FOR SHARE`);
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Customer" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${initial.customerId}::uuid FOR SHARE`);
      const customer = await tx.customer.findFirst({ where: { id: initial.customerId, organizationId: context.organizationId, active: true }, select: { id: true } });
      if (!customer) throw invalidTransition();

      const staffIds = kind === 'SPECIFIC' ? [staffMemberId!] : eligible.map(item => item.id);
      const calendarHeads = await tx.bookingCalendar.findMany({
        where: { organizationId: context.organizationId, OR: [{ kind: 'BUSINESS' }, ...(staffIds.length ? [{ staffMemberId: { in: staffIds } }] : [])] },
        select: { id: true }, orderBy: { id: 'asc' },
      });
      for (const calendar of calendarHeads) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "BookingCalendar" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${calendar.id}::uuid FOR SHARE`);
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Appointment" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${appointmentId}::uuid FOR UPDATE`);
      const current = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
      if (!current) throw notFound();
      if (publicAccess && !this.validManagementToken(current, publicAccess.token, now)) throw notFound();
      if (current.version !== expectedVersion) throw this.versionConflict();
      if (current.startAt.getTime() !== initial.startAt.getTime() || current.staffMemberId !== initial.staffMemberId || current.serviceId !== initial.serviceId) throw this.versionConflict();

      const endAt = new Date(requestedStartAt.getTime() + current.durationMinutes * 60_000);
      const calendarRows = await tx.bookingCalendar.findMany({
        where: { id: { in: calendarHeads.map(item => item.id) }, organizationId: context.organizationId },
        include: {
          weeklyWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
          dayOverrides: { where: { localDate: new Date(`${local.date}T00:00:00.000Z`) }, include: { windows: { orderBy: { startMinute: 'asc' } } } },
          timeOff: { where: { startAt: { lt: endAt }, endAt: { gt: requestedStartAt } }, select: { startAt: true, endAt: true } },
        },
      });
      const business = calendarRows.find(item => item.kind === 'BUSINESS');
      const businessCalendar = business ? mapCalendar(business) : null;
      const byStaff = new Map(calendarRows.filter(item => item.kind === 'STAFF' && item.staffMemberId).map(item => [item.staffMemberId!, mapCalendar(item)]));
      const staff: AvailabilityStaffInput[] = eligible.map(item => ({ id: item.id, name: item.name, calendar: byStaff.get(item.id) ?? null }));
      const resources = service.staffSelectionMode === 'NO_ASSIGNMENT'
        ? [{ kind: 'SERVICE' as const, serviceId: service.id }]
        : eligible.map(item => ({ kind: 'STAFF' as const, staffMemberId: item.id }));
      const busy = await this.schedulingRead.loadBusyIntervals({ organizationId: context.organizationId }, resources, { startAt: requestedStartAt, endAt }, tx);
      const result = computeAvailability({
        service: { id: service.id, durationMinutes: current.durationMinutes, staffSelectionMode: service.staffSelectionMode },
        businessCalendar, staff, busyIntervals: busy.filter(item => item.id !== appointmentId),
        selection: kind === 'SPECIFIC' ? { kind: 'SPECIFIC', staffMemberId: staffMemberId! } : kind === 'ANY' ? { kind: 'ANY' } : { kind: 'NONE' },
        fromDate: local.date, toDate: localDate.add({ days: 1 }).toString(), timeZone: organization.timezone,
        slotStepMinutes: settings.slotStepMinutes, now: now.toISOString(), at: requestedStart.toString({ smallestUnit: 'millisecond' }), limit: 1,
      });
      const slot = result.slots[0];
      if (!slot) throw new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible. Actualizá la agenda e intentá de nuevo.');

      let selectedStaffId: string | null = null;
      let selectedStaffName: string | null = null;
      if (kind === 'SPECIFIC') {
        const selected = slot.staff.find(item => item.id === staffMemberId);
        if (!selected) throw new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible. Actualizá la agenda e intentá de nuevo.');
        selectedStaffId = selected.id;
        selectedStaffName = selected.name;
      } else if (kind === 'ANY') {
        if (!slot.staff.length) throw new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible. Actualizá la agenda e intentá de nuevo.');
        const dayBounds = getLocalDayBounds(local.date, organization.timezone);
        if (!dayBounds) throw new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible.');
        const counts = await tx.appointment.groupBy({
          by: ['staffMemberId'],
          where: {
            organizationId: context.organizationId, id: { not: appointmentId }, staffMemberId: { in: slot.staff.map(item => item.id) },
            status: { in: ['CONFIRMED', 'COMPLETED'] }, startAt: { gte: dayBounds.startAt, lt: dayBounds.endAt },
          }, _count: { _all: true },
        });
        const countByStaff = new Map(counts.map(item => [item.staffMemberId!, item._count._all]));
        const chosen = [...slot.staff].sort((left, right) => {
          const delta = (countByStaff.get(left.id) ?? 0) - (countByStaff.get(right.id) ?? 0);
          return delta || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
        })[0]!;
        selectedStaffId = chosen.id;
        selectedStaffName = chosen.name;
      }

      const updated = await tx.appointment.updateMany({
        where: { id: appointmentId, organizationId: context.organizationId, version: expectedVersion, status: 'CONFIRMED' },
        data: {
          startAt: requestedStartAt, endAt, staffMemberId: selectedStaffId, staffNameSnapshot: selectedStaffName,
          assignmentKind: kind, schedulingPolicyVersion: settings.version, slotStepMinutesSnapshot: settings.slotStepMinutes,
          publicMinNoticeMinutesSnapshot: settings.publicMinNoticeMinutes, publicMaxAdvanceDaysSnapshot: settings.publicMaxAdvanceDays,
          publicCancelNoticeMinutesSnapshot: settings.publicCancelNoticeMinutes, timezoneSnapshot: organization.timezone,
          ...(publicAccess ? { managementTokenExpiresAt: new Date(endAt.getTime() + 30 * 24 * 60 * 60_000) } : {}),
          version: { increment: 1 }, updatedAt: now,
        },
      });
      if (updated.count !== 1) throw this.versionConflict();
      await tx.appointmentEvent.create({
        data: {
          organizationId: context.organizationId, appointmentId, actorType: publicAccess ? 'PUBLIC' : 'MEMBER', actorMembershipId: publicAccess ? null : context.membershipId,
          action: 'RESCHEDULED',
          before: { status: current.status, startAt: current.startAt.toISOString(), endAt: current.endAt.toISOString(), staffMemberId: current.staffMemberId, version: current.version },
          after: { status: 'CONFIRMED', startAt: requestedStartAt.toISOString(), endAt: endAt.toISOString(), staffMemberId: selectedStaffId, version: current.version + 1 },
        },
      });
      const after = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
      if (!after) throw notFound();
      return appointmentProjection(after);
    });
  }

  private async transition(context: TenantContext, appointmentId: string, ifMatch: string | undefined, status: 'CANCELLED' | 'COMPLETED' | 'NO_SHOW', action: string, reasonCode?: string) {
    const expectedVersion = parseIfMatch(ifMatch);
    return this.db.$transaction(async tx => {
      const current = await this.lockAppointmentParents(tx, context, appointmentId);
      if (current.version !== expectedVersion) throw this.versionConflict();
      const now = this.clock.now();
      if (current.status !== 'CONFIRMED') throw invalidTransition();
      if (status === 'CANCELLED') {
        if (now >= current.startAt) throw invalidTransition();
        const remaining = current.startAt.getTime() - now.getTime();
        if (remaining < current.publicCancelNoticeMinutesSnapshot * 60_000) throw invalidTransition();
      } else if (now < current.endAt) {
        throw invalidTransition();
      }
      const updated = await tx.appointment.updateMany({
        where: { id: appointmentId, organizationId: context.organizationId, status: 'CONFIRMED', version: expectedVersion },
        data: { status, version: { increment: 1 }, updatedAt: now },
      });
      if (updated.count !== 1) throw this.versionConflict();
      await this.writeEvent(tx, context, current, action, reasonCode ?? null, status, now);
      const after = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
      if (!after) throw notFound();
      return appointmentProjection(after);
    });
  }

  private validManagementToken(appointment: {
    organizationId: string; id: string; managementTokenHash: string | null;
    managementTokenKeyVersion: number | null; managementTokenVersion: number; managementTokenExpiresAt: Date | null;
  }, token: string, now: Date): boolean {
    if (!appointment.managementTokenHash || !appointment.managementTokenKeyVersion || !appointment.managementTokenExpiresAt || appointment.managementTokenExpiresAt <= now) return false;
    const secret = this.security.managementTokenSecretFor(appointment.managementTokenKeyVersion);
    if (!secret) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'La clave de gestión no está disponible temporalmente.');
    // Also bind the opaque bearer to the appointment/version; the stored hash alone is never authority.
    const candidate = deriveManagementToken(secret, appointment.organizationId, appointment.id, appointment.managementTokenVersion);
    return candidate === token && matchesManagementToken(token, appointment.managementTokenHash);
  }

  private async lockAppointmentParents(tx: TransactionContext, context: TenantContext, appointmentId: string) {
    const initial = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
    if (!initial) throw notFound();
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId}::uuid FOR SHARE`);
    await tx.$queryRaw(Prisma.sql`SELECT "organizationId" FROM "SchedulingSettings" WHERE "organizationId" = ${context.organizationId}::uuid FOR SHARE`);
    const organization = await tx.organization.findUnique({ where: { id: context.organizationId }, select: { timezone: true } });
    if (!organization) throw notFound();
    const day = toLocalDateTime(initial.startAt.toISOString(), organization.timezone).date;
    if (initial.staffMemberId) {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${context.organizationId}), hashtext(${day}))`);
    } else if (initial.assignmentKind === 'NONE') {
      const capacityKey = `NO_ASSIGNMENT:${initial.serviceId}:${day}`;
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${context.organizationId}), hashtext(${capacityKey}))`);
    }
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Service" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${initial.serviceId}::uuid FOR SHARE`);
    if (initial.staffMemberId) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "StaffMember" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${initial.staffMemberId}::uuid FOR SHARE`);
    }
    const calendars = await tx.bookingCalendar.findMany({
      where: { organizationId: context.organizationId, OR: [{ kind: 'BUSINESS' }, ...(initial.staffMemberId ? [{ staffMemberId: initial.staffMemberId }] : [])] },
      select: { id: true }, orderBy: { id: 'asc' },
    });
    for (const calendar of calendars) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "BookingCalendar" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${calendar.id}::uuid FOR SHARE`);
    }
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Appointment" WHERE "organizationId" = ${context.organizationId}::uuid AND "id" = ${appointmentId}::uuid FOR UPDATE`);
    const current = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId: context.organizationId } });
    if (!current) throw notFound();
    if (current.serviceId !== initial.serviceId || current.staffMemberId !== initial.staffMemberId || current.startAt.getTime() !== initial.startAt.getTime()) {
      throw new ApiError(412, 'VERSION_CONFLICT', 'La reserva cambió desde la última lectura. Recargá y conciliá los cambios.');
    }
    return current;
  }

  private async assertRestorable(
    tx: TransactionContext,
    organizationId: string,
    current: Awaited<ReturnType<AppointmentLifecycleService['lockAppointmentParents']>>,
    requireActive: boolean,
  ) {
    let serviceMode = current.serviceSelectionModeSnapshot;
    if (requireActive) {
      const activeService = await tx.service.findFirst({ where: { id: current.serviceId, organizationId, active: true }, select: { id: true, staffSelectionMode: true } });
      const activeCustomer = await tx.customer.findFirst({ where: { id: current.customerId, organizationId, active: true }, select: { id: true } });
      if (!activeService || !activeCustomer) throw invalidTransition();
      if (activeService.staffSelectionMode !== current.serviceSelectionModeSnapshot) throw new ApiError(409, 'BOOKING_CONFIGURATION_CHANGED', 'El modo del servicio cambió. Resolvé la reserva con una acción explícita.');
      serviceMode = activeService.staffSelectionMode;
      if (current.staffMemberId) {
        const eligibility = await tx.staffService.findFirst({ where: { organizationId, serviceId: current.serviceId, staffMemberId: current.staffMemberId, staffMember: { active: true } }, select: { staffMemberId: true } });
        if (!eligibility) throw invalidTransition();
      }
      const settings = await tx.schedulingSettings.findUnique({ where: { organizationId } });
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
      if (!settings || !organization || organization.timezone !== current.timezoneSnapshot) {
        throw new ApiError(409, 'BOOKING_CONFIGURATION_CHANGED', 'La zona o configuración de agenda cambió. Resolvé la reserva antes de restaurarla.');
      }
      const local = toLocalDateTime(current.startAt.toISOString(), organization.timezone);
      const startMinute = Number(local.time.slice(0, 2)) * 60 + Number(local.time.slice(3, 5));
      if (startMinute % settings.slotStepMinutes !== 0) throw new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no coincide con la grilla vigente.');

      const eligible = current.staffMemberId
        ? await this.staffServices.listEligibleStaff({ organizationId }, current.serviceId, tx)
        : [];
      if (current.assignmentKind === 'NONE' && serviceMode !== 'NO_ASSIGNMENT') throw invalidTransition();
      if (current.assignmentKind !== 'NONE' && !eligible.some(item => item.id === current.staffMemberId)) throw invalidTransition();
      const staffIds = current.staffMemberId ? [current.staffMemberId] : [];
      const calendars = await tx.bookingCalendar.findMany({
        where: { organizationId, OR: [{ kind: 'BUSINESS' }, ...(staffIds.length ? [{ staffMemberId: { in: staffIds } }] : [])] },
        include: {
          weeklyWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
          dayOverrides: { where: { localDate: new Date(`${local.date}T00:00:00.000Z`) }, include: { windows: { orderBy: { startMinute: 'asc' } } } },
          timeOff: { where: { startAt: { lt: current.endAt }, endAt: { gt: current.startAt } }, select: { startAt: true, endAt: true } },
        },
      });
      const business = calendars.find(item => item.kind === 'BUSINESS');
      const businessCalendar = business ? mapCalendar(business) : null;
      const byStaff = new Map(calendars.filter(item => item.kind === 'STAFF' && item.staffMemberId).map(item => [item.staffMemberId!, mapCalendar(item)]));
      const staffInput: AvailabilityStaffInput[] = eligible.map(item => ({ id: item.id, name: item.name, calendar: byStaff.get(item.id) ?? null }));
      const resources = current.assignmentKind === 'NONE'
        ? [{ kind: 'SERVICE' as const, serviceId: current.serviceId }]
        : staffIds.map(id => ({ kind: 'STAFF' as const, staffMemberId: id }));
      const busy = await this.schedulingRead.loadBusyIntervals({ organizationId }, resources, { startAt: current.startAt, endAt: current.endAt }, tx);
      const selection = current.assignmentKind === 'NONE'
        ? { kind: 'NONE' as const }
        : current.assignmentKind === 'SPECIFIC'
          ? { kind: 'SPECIFIC' as const, staffMemberId: current.staffMemberId! }
          : { kind: 'ANY' as const };
      const result = computeAvailability({
        service: { id: current.serviceId, durationMinutes: current.durationMinutes, staffSelectionMode: serviceMode },
        businessCalendar, staff: staffInput, busyIntervals: busy.filter(item => item.id !== current.id), selection,
        fromDate: local.date, toDate: Temporal.PlainDate.from(local.date).add({ days: 1 }).toString(),
        timeZone: organization.timezone, slotStepMinutes: settings.slotStepMinutes,
        now: this.clock.now().toISOString(), at: current.startAt.toISOString(), limit: 1,
      });
      const slot = result.slots[0];
      if (!slot || (current.staffMemberId && !slot.staff.some(item => item.id === current.staffMemberId))) {
        throw new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible. Actualizá la agenda e intentá de nuevo.');
      }
    }
    const endAt = new Date(current.startAt.getTime() + current.durationMinutes * 60_000);
    const conflict = await tx.appointment.findFirst({
      where: {
        organizationId, id: { not: current.id }, status: { not: 'CANCELLED' },
        startAt: { lt: endAt }, endAt: { gt: current.startAt },
        ...(current.staffMemberId ? { staffMemberId: current.staffMemberId } : { serviceId: current.serviceId, assignmentKind: 'NONE' }),
      }, select: { id: true },
    });
    if (conflict) throw new ApiError(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible. Actualizá la agenda e intentá de nuevo.');
  }

  private async writeEvent(tx: TransactionContext, context: TenantContext, before: {
    id: string; organizationId: string; status: string; version: number; startAt: Date; endAt: Date; staffMemberId: string | null;
  }, action: string, reasonCode: string | null, afterStatus: string, now: Date) {
    await tx.appointmentEvent.create({
      data: {
        organizationId: context.organizationId, appointmentId: before.id, actorType: 'MEMBER',
        actorMembershipId: context.membershipId, action, reasonCode,
        before: { status: before.status, startAt: before.startAt.toISOString(), endAt: before.endAt.toISOString(), staffMemberId: before.staffMemberId, version: before.version },
        after: { status: afterStatus, startAt: before.startAt.toISOString(), endAt: before.endAt.toISOString(), staffMemberId: before.staffMemberId, version: before.version + 1, changedAt: now.toISOString() },
      },
    });
  }

  private decodeCursor(cursor: string | undefined, query: AppointmentListQueryDto, organizationId: string) {
    if (!cursor) return null;
    try {
      const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { startAt?: unknown; id?: unknown; filters?: unknown };
      if (typeof value.startAt !== 'string' || !Number.isFinite(Date.parse(value.startAt)) ||
        new Date(value.startAt).toISOString() !== value.startAt || typeof value.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ||
        value.filters !== this.cursorFilter(query, organizationId)) throw new Error();
      return { startAt: value.startAt, id: value.id };
    } catch { throw new ApiError(400, 'VALIDATION_ERROR', 'El cursor no es válido para estos filtros.'); }
  }

  private encodeCursor(last: { startAt: string; id: string }, query: AppointmentListQueryDto, organizationId: string) {
    return Buffer.from(JSON.stringify({ startAt: last.startAt, id: last.id, filters: this.cursorFilter(query, organizationId) })).toString('base64url');
  }

  private cursorFilter(query: AppointmentListQueryDto, organizationId: string) {
    return JSON.stringify({ organizationId, fromDate: query.fromDate, toDate: query.toDate, staffMemberId: query.staffMemberId ?? null, customerId: query.customerId ?? null, status: query.status ?? null, limit: query.limit });
  }

  private versionConflict() { return new ApiError(412, 'VERSION_CONFLICT', 'La reserva cambió desde la última lectura. Recargá y conciliá los cambios.'); }
}
