import { Injectable } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { ApiError } from '../common/errors.js';
import { PrismaService } from '../database/prisma.service.js';
import type { TransactionContext } from '../common/transaction.js';
import { Clock } from '../common/clock.js';
import { SchedulingReadService, type BookingScope, type FutureCalendarBooking } from './scheduling-read.service.js';
import { validateSchedulingTimePolicy, DEFAULT_SCHEDULING_TIME_POLICY } from './scheduling-time-policy.js';
import type {
  CreateBookingCalendarDto, CreateCalendarTimeOffDto, PatchSchedulingSettingsDto,
  ReplaceOverrideWindowsDto, ReplaceWeeklyWindowsDto,
} from './calendar.dto.js';
import { toLocalDateTime } from './time-zone-adapter.js';

type Window = { startMinute: number; endMinute: number };
type WindowWithWeekday = Window & { weekday?: number };

function validateWindows(windows: readonly Window[], withWeekday = false): void {
  const sorted = [...windows] as WindowWithWeekday[];
  sorted.sort((left, right) =>
    (left.weekday ?? 0) - (right.weekday ?? 0) ||
    left.startMinute - right.startMinute,
  );
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    if (!Number.isInteger(current.startMinute) || !Number.isInteger(current.endMinute) ||
      current.startMinute < 0 || current.startMinute > 1439 || current.endMinute < 1 || current.endMinute > 1440 ||
      current.startMinute >= current.endMinute || (withWeekday && (current.weekday === undefined || current.weekday < 1 || current.weekday > 7))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'El intervalo de horario no es válido.');
    }
    const previous = sorted[index - 1];
    if (previous && (current.weekday === undefined || current.weekday === previous.weekday) &&
      current.startMinute < previous.endMinute) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Los intervalos del mismo día no pueden superponerse.');
    }
  }
}

function dayHasCoverage(booking: FutureCalendarBooking, date: string, timeZone: string, windows: readonly Window[]): boolean {
  const start = toLocalDateTime(booking.startAt.toISOString(), timeZone);
  const end = toLocalDateTime(booking.endAt.toISOString(), timeZone);
  const localStart = Temporal.PlainDate.from(start.date);
  const localEnd = Temporal.PlainDate.from(end.date);
  const localDate = Temporal.PlainDate.from(date);
  if (Temporal.PlainDate.compare(localDate, localStart) < 0 || Temporal.PlainDate.compare(localDate, localEnd) > 0) return true;
  const exactMidnightEnd = end.time === '00:00' && Temporal.PlainDate.compare(localDate, localEnd) === 0;
  if (exactMidnightEnd) return true;
  const startMinute = Temporal.PlainDate.compare(localDate, localStart) === 0
    ? Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3, 5)) : 0;
  const endMinute = Temporal.PlainDate.compare(localDate, localEnd) === 0
    ? Number(end.time.slice(0, 2)) * 60 + Number(end.time.slice(3, 5)) : 1440;
  return windows.some(window => window.startMinute <= startMinute && window.endMinute >= endMinute);
}

function parseLocalDate(date: string): Date {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Temporal.PlainDate.from(date, { overflow: 'reject' }).toString() !== date) {
      throw new RangeError('Invalid date.');
    }
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'La fecha local no es válida.');
  }
  return new Date(`${date}T00:00:00.000Z`);
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly db: PrismaService,
    private readonly read: SchedulingReadService,
    private readonly clock: Clock,
  ) {}

  private async lockOrganization(scope: BookingScope, tx: TransactionContext): Promise<void> {
    if (!scope.organizationId) throw new ApiError(400, 'INVALID_SCHEDULING_SCOPE', 'Se requiere una organización.');
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id" = ${scope.organizationId}::uuid FOR SHARE`;
    if (!rows.length) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
  }

  private async lockCalendar(scope: BookingScope, calendarId: string, expectedVersion: number, tx: TransactionContext) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "BookingCalendar" WHERE "organizationId" = ${scope.organizationId}::uuid AND "id" = ${calendarId}::uuid FOR UPDATE`;
    if (!rows.length) throw new ApiError(404, 'CALENDAR_NOT_FOUND', 'No se encontró el calendario.');
    const calendar = await tx.bookingCalendar.findFirst({ where: { organizationId: scope.organizationId, id: calendarId } });
    if (!calendar) throw new ApiError(404, 'CALENDAR_NOT_FOUND', 'No se encontró el calendario.');
    if (calendar.version !== expectedVersion) throw new ApiError(412, 'VERSION_MISMATCH', 'El calendario cambió. Actualizá la información.');
    return calendar;
  }

  async getSettings(scope: BookingScope) {
    const settings = await this.db.schedulingSettings.upsert({
      where: { organizationId: scope.organizationId },
      create: { organizationId: scope.organizationId },
      update: {},
    });
    const policy = {
      slotStepMinutes: settings.slotStepMinutes,
      publicMinNoticeMinutes: settings.publicMinNoticeMinutes,
      publicMaxAdvanceDays: settings.publicMaxAdvanceDays,
      publicCancelNoticeMinutes: settings.publicCancelNoticeMinutes,
    };
    validateSchedulingTimePolicy(policy);
    return { ...settings, policy, defaults: DEFAULT_SCHEDULING_TIME_POLICY };
  }

  async updateSettings(scope: BookingScope, input: PatchSchedulingSettingsDto, version: number) {
    return this.db.$transaction(async tx => {
      await this.lockOrganization(scope, tx);
      await tx.schedulingSettings.upsert({
        where: { organizationId: scope.organizationId },
        create: { organizationId: scope.organizationId },
        update: {},
      });
      const current = await tx.schedulingSettings.findUnique({ where: { organizationId: scope.organizationId } });
      if (!current) throw new ApiError(404, 'SCHEDULING_SETTINGS_NOT_FOUND', 'No se encontró la configuración de agenda.');
      if (current.version !== version) throw new ApiError(412, 'VERSION_MISMATCH', 'La configuración cambió. Actualizá la información.');
      validateSchedulingTimePolicy({
        slotStepMinutes: input.slotStepMinutes ?? current.slotStepMinutes,
        publicMinNoticeMinutes: input.publicMinNoticeMinutes ?? current.publicMinNoticeMinutes,
        publicMaxAdvanceDays: input.publicMaxAdvanceDays ?? current.publicMaxAdvanceDays,
        publicCancelNoticeMinutes: input.publicCancelNoticeMinutes ?? current.publicCancelNoticeMinutes,
      });
      const result = await tx.schedulingSettings.updateMany({
        where: { organizationId: scope.organizationId, version },
        data: { ...input, version: { increment: 1 }, updatedAt: this.clock.now() },
      });
      if (result.count !== 1) throw new ApiError(412, 'VERSION_MISMATCH', 'La configuración cambió. Actualizá la información.');
      return tx.schedulingSettings.findUnique({ where: { organizationId: scope.organizationId } });
    });
  }

  async listCalendars(scope: BookingScope) {
    await this.db.$transaction(async tx => {
      await this.lockOrganization(scope, tx);
      const businessCalendar = await tx.bookingCalendar.findFirst({
        where: { organizationId: scope.organizationId, kind: 'BUSINESS' }, select: { id: true },
      });
      if (!businessCalendar) await tx.bookingCalendar.create({ data: { organizationId: scope.organizationId, kind: 'BUSINESS' } });
    });
    return this.db.bookingCalendar.findMany({
      where: { organizationId: scope.organizationId },
      include: {
        weeklyWindows: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
        dayOverrides: { orderBy: { localDate: 'asc' }, include: { windows: { orderBy: { startMinute: 'asc' } } } },
        timeOff: { orderBy: [{ startAt: 'asc' }, { id: 'asc' }], select: { id: true, startAt: true, endAt: true, reasonCode: true } },
      },
      orderBy: [{ kind: 'asc' }, { staffMemberId: 'asc' }],
    });
  }

  async createCalendar(scope: BookingScope, input: CreateBookingCalendarDto) {
    return this.db.$transaction(async tx => {
      await this.lockOrganization(scope, tx);
      if (input.kind === 'BUSINESS') {
        if (input.staffMemberId) throw new ApiError(400, 'VALIDATION_ERROR', 'El calendario de negocio no admite un profesional.');
        const existing = await tx.bookingCalendar.findFirst({ where: { organizationId: scope.organizationId, kind: 'BUSINESS' }, select: { id: true } });
        if (existing) throw new ApiError(409, 'BUSINESS_CALENDAR_EXISTS', 'La organización ya tiene su calendario de negocio.');
        return tx.bookingCalendar.create({ data: { organizationId: scope.organizationId, kind: 'BUSINESS' } });
      }
      if (!input.staffMemberId) throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá el profesional del calendario.');
      const staff = await tx.staffMember.findFirst({
        where: { id: input.staffMemberId, organizationId: scope.organizationId, active: true },
        select: { id: true },
      });
      if (!staff) throw new ApiError(404, 'STAFF_MEMBER_NOT_FOUND', 'No se encontró un profesional activo de esta organización.');
      try {
        return await tx.bookingCalendar.create({ data: { organizationId: scope.organizationId, kind: 'STAFF', staffMemberId: staff.id } });
      } catch (error) {
        if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'P2002') {
          throw new ApiError(409, 'CALENDAR_ALREADY_EXISTS', 'El profesional ya tiene un calendario.');
        }
        throw error;
      }
    });
  }

  async replaceWeeklyWindows(scope: BookingScope, calendarId: string, input: ReplaceWeeklyWindowsDto, version: number) {
    validateWindows(input.windows, true);
    return this.db.$transaction(async tx => {
      await this.lockOrganization(scope, tx);
      const calendar = await this.lockCalendar(scope, calendarId, version, tx);
      const now = this.clock.now();
      const futureBookings = await this.read.listFutureBookingsForCalendar(scope, calendarId, tx, now);
      const overrides = await tx.calendarDayOverride.findMany({
        where: { organizationId: scope.organizationId, calendarId }, select: { localDate: true },
      });
      const overrideDates = new Set(overrides.map(row => row.localDate.toISOString().slice(0, 10)));
      const organization = await tx.organization.findUnique({ where: { id: scope.organizationId }, select: { timezone: true } });
      if (!organization) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
      const changedBookings = futureBookings.filter(booking => {
        const start = Temporal.PlainDate.from(toLocalDateTime(booking.startAt.toISOString(), organization.timezone).date);
        const end = Temporal.PlainDate.from(toLocalDateTime(booking.endAt.toISOString(), organization.timezone).date);
        for (let date = start; Temporal.PlainDate.compare(date, end) <= 0; date = date.add({ days: 1 })) {
          if (overrideDates.has(date.toString())) continue;
          const applicable = input.windows.filter(window => window.weekday === date.dayOfWeek);
          if (!dayHasCoverage(booking, date.toString(), organization.timezone, applicable)) return true;
        }
        return false;
      });
      if (changedBookings.length) throw this.scheduleConflict(changedBookings);

      await tx.calendarWeeklyWindow.deleteMany({ where: { organizationId: scope.organizationId, calendarId } });
      if (input.windows.length) {
        await tx.calendarWeeklyWindow.createMany({
          data: input.windows.map(window => ({ ...window, organizationId: scope.organizationId, calendarId })),
        });
      }
      await tx.bookingCalendar.update({ where: { organizationId_id: { organizationId: scope.organizationId, id: calendar.id } }, data: { version: { increment: 1 }, updatedAt: now } });
      return { calendarId, version: calendar.version + 1, weeklyWindows: input.windows };
    });
  }

  async replaceDayOverride(scope: BookingScope, calendarId: string, localDate: string, input: ReplaceOverrideWindowsDto, version: number) {
    const dbDate = parseLocalDate(localDate);
    validateWindows(input.windows);
    return this.db.$transaction(async tx => {
      await this.lockOrganization(scope, tx);
      const calendar = await this.lockCalendar(scope, calendarId, version, tx);
      const now = this.clock.now();
      const futureBookings = await this.read.listFutureBookingsForCalendar(scope, calendarId, tx, now);
      const organization = await tx.organization.findUnique({ where: { id: scope.organizationId }, select: { timezone: true } });
      if (!organization) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
      const affected = futureBookings.filter(booking => {
        const start = Temporal.PlainDate.from(toLocalDateTime(booking.startAt.toISOString(), organization.timezone).date);
        const end = Temporal.PlainDate.from(toLocalDateTime(booking.endAt.toISOString(), organization.timezone).date);
        const day = Temporal.PlainDate.from(localDate);
        return Temporal.PlainDate.compare(day, start) >= 0 && Temporal.PlainDate.compare(day, end) <= 0 &&
          !dayHasCoverage(booking, localDate, organization.timezone, input.windows);
      });
      if (affected.length) throw this.scheduleConflict(affected);

      await tx.calendarDayOverride.upsert({
        where: { organizationId_calendarId_localDate: { organizationId: scope.organizationId, calendarId, localDate: dbDate } },
        create: {
          organizationId: scope.organizationId, calendarId, localDate: dbDate,
          windows: { create: input.windows.map(window => ({ ...window, organizationId: scope.organizationId })) },
        },
        update: {
          windows: {
            deleteMany: {},
            ...(input.windows.length ? { create: input.windows.map(window => ({ ...window, organizationId: scope.organizationId })) } : {}),
          },
        },
      });
      await tx.bookingCalendar.update({ where: { organizationId_id: { organizationId: scope.organizationId, id: calendar.id } }, data: { version: { increment: 1 }, updatedAt: now } });
      return { calendarId, localDate, version: calendar.version + 1, windows: input.windows };
    });
  }

  async createTimeOff(scope: BookingScope, calendarId: string, input: CreateCalendarTimeOffDto, version: number) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'El rango de ausencia debe ser válido y tener duración positiva.');
    }
    return this.db.$transaction(async tx => {
      await this.lockOrganization(scope, tx);
      const calendar = await this.lockCalendar(scope, calendarId, version, tx);
      const now = this.clock.now();
      const futureBookings = await this.read.listFutureBookingsForCalendar(scope, calendarId, tx, now);
      const affected = futureBookings.filter(booking => booking.startAt < endAt && booking.endAt > startAt);
      if (affected.length) throw this.scheduleConflict(affected);
      const timeOff = await tx.calendarTimeOff.create({
        data: { organizationId: scope.organizationId, calendarId, startAt, endAt, reasonCode: input.reasonCode },
      });
      await tx.bookingCalendar.update({ where: { organizationId_id: { organizationId: scope.organizationId, id: calendar.id } }, data: { version: { increment: 1 }, updatedAt: now } });
      return { id: timeOff.id, calendarId, startAt: startAt.toISOString(), endAt: endAt.toISOString(), version: calendar.version + 1 };
    });
  }

  private scheduleConflict(bookings: readonly { id: string }[]): ApiError {
    return new ApiError(409, 'SCHEDULE_HAS_BOOKINGS', 'El cambio de horario afecta reservas confirmadas futuras.', {
      affectedBookingIds: bookings.slice(0, 10).map(booking => booking.id),
      affectedCount: [String(bookings.length)],
    });
  }
}
