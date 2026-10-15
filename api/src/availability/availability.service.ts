import { Injectable } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { ApiError } from '../common/errors.js';
import { Clock } from '../common/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import type { BookingScope } from './scheduling-read.service.js';
import { SchedulingReadService } from './scheduling-read.service.js';
import { ServiceCatalogService } from '../service-catalog/service-catalog.service.js';
import { StaffServicesService } from '../staff/staff-services.service.js';
import { computeAvailability, type AvailabilityCalendar, type AvailabilitySelection, type AvailabilityStaffInput } from './availability-engine.js';
import { getLocalDayBounds, toLocalDateTime, type UtcInstant } from './time-zone-adapter.js';
import type { AvailabilityQueryDto } from './availability.dto.js';

function localDate(value: string): Temporal.PlainDate {
  try {
    const date = Temporal.PlainDate.from(value, { overflow: 'reject' });
    if (date.toString() !== value) throw new RangeError('Invalid date.');
    return date;
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'La fecha local no es válida.');
  }
}

function findLocalDayStart(date: Temporal.PlainDate, timeZone: string): Date {
  for (let offset = 0; offset <= 370; offset += 1) {
    const bounds = getLocalDayBounds(date.add({ days: offset }).toString(), timeZone);
    if (bounds) return bounds.startAt;
  }
  throw new ApiError(400, 'INVALID_TIME_ZONE', 'No se pudo resolver el límite de fecha para la zona horaria.');
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
export class AvailabilityService {
  constructor(
    private readonly db: PrismaService,
    private readonly schedulingRead: SchedulingReadService,
    private readonly services: ServiceCatalogService,
    private readonly staffServices: StaffServicesService,
    private readonly clock: Clock,
  ) {}

  async find(scope: BookingScope, query: AvailabilityQueryDto, publicOnly = false, publicSlug?: string) {
    return this.findWithExclusion(scope, query, publicOnly, publicSlug);
  }

  private async findWithExclusion(scope: BookingScope, query: AvailabilityQueryDto, publicOnly = false, publicSlug?: string, excludeAppointmentId?: string) {
    validateAvailabilityQueryShape(query);
    if ((query.selection === 'SPECIFIC') !== (query.staffMemberId !== undefined)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'staffMemberId sólo se admite y es obligatorio para selección SPECIFIC.');
    }

    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${scope.organizationId}::uuid FOR SHARE`;
      const organization = await tx.organization.findUnique({ where: { id: scope.organizationId }, select: { timezone: true, slug: true } });
      if (!organization) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
      if (publicOnly && organization.slug !== publicSlug) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
      if (publicOnly) {
        const publishedService = await tx.service.findFirst({ where: { id: query.serviceId, organizationId: scope.organizationId, active: true, publicBookable: true }, select: { id: true } });
        if (!publishedService) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
      }
      const service = await this.services.getBookableService(scope, query.serviceId, tx);
      const settings = publicOnly
        ? await tx.schedulingSettings.findUnique({ where: { organizationId: scope.organizationId } })
        : await tx.schedulingSettings.upsert({ where: { organizationId: scope.organizationId }, create: { organizationId: scope.organizationId }, update: {} });
      const subscription = publicOnly ? await tx.subscription.findUnique({ where: { organizationId: scope.organizationId } }) : null;
      if (publicOnly && (!settings?.publicBookingEnabled || !subscription || !(
        subscription.status === 'TRIALING' ? subscription.trialStartedAt <= this.clock.now() && this.clock.now() < subscription.trialEndsAt
          : subscription.status === 'ACTIVE' && !!subscription.paidThrough && subscription.paidThrough > this.clock.now()
      ))) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
      if (!settings) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
      const now = this.clock.now();
      const nowLocalDate = Temporal.PlainDate.from(toLocalDateTime(now.toISOString(), organization.timezone).date);
      let fromDate: Temporal.PlainDate;
      let toDate: Temporal.PlainDate;
      let at: UtcInstant | undefined;
      if (query.at) {
        if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(query.at)) throw new ApiError(400, 'VALIDATION_ERROR', 'El instante debe incluir Z u offset explícito.');
        let instant: Temporal.Instant;
        try { instant = Temporal.Instant.from(query.at); }
        catch { throw new ApiError(400, 'VALIDATION_ERROR', 'El instante no es válido.'); }
        if (instant.epochNanoseconds % 60_000_000_000n !== 0n) throw new ApiError(400, 'VALIDATION_ERROR', 'El instante debe estar alineado a minutos completos.');
        at = instant.toString({ smallestUnit: 'millisecond' });
        fromDate = Temporal.PlainDate.from(toLocalDateTime(at, organization.timezone).date);
        toDate = fromDate.add({ days: 1 });
      } else {
        fromDate = localDate(query.fromDate!);
        toDate = localDate(query.toDate!);
      }
      const dayCount = fromDate.until(toDate, { largestUnit: 'day' }).days;
      if (dayCount < 1 || dayCount > 7 || Temporal.PlainDate.compare(fromDate, nowLocalDate) < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Consultá entre uno y siete días locales, desde hoy y dentro del horizonte interno.');
      }
      const horizon = nowLocalDate.add({ days: publicOnly ? settings.publicMaxAdvanceDays : 365 });
      if (Temporal.PlainDate.compare(toDate.subtract({ days: 1 }), horizon) > 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', publicOnly ? 'La consulta excede el horizonte público vigente.' : 'La consulta excede el horizonte interno de 365 días locales.');
      }

      const selection = query.selection as AvailabilitySelection['kind'];
      if ((service.staffSelectionMode === 'NO_ASSIGNMENT' && selection !== 'NONE') ||
        (service.staffSelectionMode === 'AUTO_ASSIGN' && selection !== 'ANY') ||
        (service.staffSelectionMode === 'CUSTOMER_CHOICE' && selection === 'NONE')) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'La selección solicitada no corresponde al modo del servicio.');
      }

      const eligible = service.staffSelectionMode === 'NO_ASSIGNMENT'
        ? []
        : await this.staffServices.listEligibleStaff(scope, service.id, tx);
      const staff = query.selection === 'SPECIFIC'
        ? eligible.filter(item => item.id === query.staffMemberId)
        : eligible;
      if (query.selection === 'SPECIFIC' && !staff.length) {
        return { slots: [], hasMore: false, nextCursor: null, timeZone: organization.timezone };
      }
      const staffIds = staff.map(item => item.id);
      const calendarRows = await tx.bookingCalendar.findMany({
        where: {
          organizationId: scope.organizationId,
          OR: [{ kind: 'BUSINESS' }, ...(staffIds.length ? [{ staffMemberId: { in: staffIds } }] : [])],
        },
        include: {
          weeklyWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
          dayOverrides: { include: { windows: { orderBy: { startMinute: 'asc' } } } },
          timeOff: { select: { startAt: true, endAt: true } },
        },
      });
      const businessRow = calendarRows.find(item => item.kind === 'BUSINESS');
      const businessCalendar = businessRow ? mapCalendar(businessRow) : null;
      const byStaffId = new Map(calendarRows.filter(item => item.kind === 'STAFF' && item.staffMemberId).map(item => [item.staffMemberId!, mapCalendar(item)]));
      const staffInputs: AvailabilityStaffInput[] = staff.map(item => ({ id: item.id, name: item.name, calendar: byStaffId.get(item.id) ?? null }));

      const queryStart = findLocalDayStart(fromDate.subtract({ days: 1 }), organization.timezone);
      const queryEnd = new Date(findLocalDayStart(toDate.add({ days: 2 }), organization.timezone).getTime());
      const resources = service.staffSelectionMode === 'NO_ASSIGNMENT'
        ? [{ kind: 'SERVICE' as const, serviceId: service.id }]
        : staffIds.map(staffMemberId => ({ kind: 'STAFF' as const, staffMemberId }));
      const busyIntervals = await this.schedulingRead.loadBusyIntervals(scope, resources, { startAt: queryStart, endAt: queryEnd }, tx, excludeAppointmentId);
      const result = computeAvailability({
        service: { id: service.id, durationMinutes: service.durationMinutes, staffSelectionMode: service.staffSelectionMode },
        businessCalendar, staff: staffInputs, busyIntervals,
        selection: query.selection === 'SPECIFIC'
          ? { kind: 'SPECIFIC', staffMemberId: query.staffMemberId! }
          : query.selection === 'ANY' ? { kind: 'ANY' } : { kind: 'NONE' },
        fromDate: fromDate.toString(), toDate: toDate.toString(), timeZone: organization.timezone,
        slotStepMinutes: settings.slotStepMinutes,
        now: new Date(now.getTime() + (publicOnly ? settings.publicMinNoticeMinutes * 60_000 : 0)).toISOString(),
        limit: 2_000, cursor: query.cursor, at,
      });
      return { ...result, timeZone: organization.timezone, settingsVersion: settings.version };
    });
  }

  async findPublic(slug: string, query: AvailabilityQueryDto) {
    const organization = await this.db.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!organization) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
    return this.find({ organizationId: organization.id }, query, true, slug);
  }

  async findPublicForReschedule(slug: string, query: AvailabilityQueryDto, appointmentId: string) {
    const organization = await this.db.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!organization) throw new ApiError(404, 'BOOKING_NOT_AVAILABLE', 'La reserva pública no está disponible.');
    return this.findWithExclusion({ organizationId: organization.id }, query, true, slug, appointmentId);
  }
}

function validateAvailabilityQueryShape(query: AvailabilityQueryDto): void {
  const hasAt = query.at !== undefined;
  const hasFromDate = query.fromDate !== undefined;
  const hasToDate = query.toDate !== undefined;
  const hasCompleteRange = hasFromDate && hasToDate;
  const hasPartialRange = hasFromDate !== hasToDate;

  if (hasPartialRange || hasAt === hasCompleteRange) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá un instante `at` o un rango completo fromDate/toDate.');
  }
}
