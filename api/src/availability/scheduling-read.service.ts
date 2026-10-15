import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/errors.js';
import type { TransactionContext } from '../common/transaction.js';

export interface BookingScope {
  organizationId: string;
}

export type BookingResource =
  | { kind: 'STAFF'; staffMemberId: string }
  | { kind: 'SERVICE'; serviceId: string };

export interface UtcWindow {
  startAt: Date;
  endAt: Date;
}

export interface BusyInterval {
  id: string;
  serviceId: string;
  staffMemberId: string | null;
  assignmentKind: 'SPECIFIC' | 'ANY' | 'NONE';
  startAt: Date;
  endAt: Date;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
}

export interface FutureCalendarBooking {
  id: string;
  startAt: Date;
  endAt: Date;
  timezoneSnapshot: string;
  staffMemberId: string | null;
}

function assertScope(scope: BookingScope): void {
  if (!scope || typeof scope.organizationId !== 'string' || scope.organizationId.trim() === '') {
    throw new ApiError(400, 'INVALID_SCHEDULING_SCOPE', 'Se requiere una organización para consultar la agenda.');
  }
}

@Injectable()
export class SchedulingReadService {
  async loadBusyIntervals(
    scope: BookingScope,
    resources: readonly BookingResource[],
    window: UtcWindow,
    tx: TransactionContext,
    excludeAppointmentId?: string,
  ): Promise<BusyInterval[]> {
    assertScope(scope);
    if (window.endAt <= window.startAt) throw new RangeError('The scheduling window must have positive duration.');
    if (resources.length === 0) return [];

    const staffIds = resources.filter((resource): resource is Extract<BookingResource, { kind: 'STAFF' }> => resource.kind === 'STAFF')
      .map(resource => resource.staffMemberId);
    const serviceIds = resources.filter((resource): resource is Extract<BookingResource, { kind: 'SERVICE' }> => resource.kind === 'SERVICE')
      .map(resource => resource.serviceId);
    const resourceFilters = [
      ...(staffIds.length ? [{ staffMemberId: { in: [...new Set(staffIds)] } }] : []),
      ...(serviceIds.length ? [{ serviceId: { in: [...new Set(serviceIds)] }, assignmentKind: 'NONE' as const }] : []),
    ];

    return tx.appointment.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        status: { not: 'CANCELLED' },
        startAt: { lt: window.endAt },
        endAt: { gt: window.startAt },
        OR: resourceFilters,
      },
      select: {
        id: true, serviceId: true, staffMemberId: true, assignmentKind: true,
        startAt: true, endAt: true, status: true,
      },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    }) as Promise<BusyInterval[]>;
  }

  async listFutureBookingsForCalendar(
    scope: BookingScope,
    calendarId: string,
    tx: TransactionContext,
    now: Date,
  ): Promise<FutureCalendarBooking[]> {
    assertScope(scope);
    const calendar = await tx.bookingCalendar.findFirst({
      where: { id: calendarId, organizationId: scope.organizationId },
      select: { kind: true, staffMemberId: true },
    });
    if (!calendar) throw new ApiError(404, 'CALENDAR_NOT_FOUND', 'No se encontró el calendario.');

    const bookings: FutureCalendarBooking[] = [];
    let cursorId: string | undefined;
    for (;;) {
      const page = await tx.appointment.findMany({
        where: {
          organizationId: scope.organizationId,
          status: 'CONFIRMED',
          endAt: { gt: now },
          ...(calendar.kind === 'STAFF' ? { staffMemberId: calendar.staffMemberId } : {}),
          ...(cursorId ? { id: { gt: cursorId } } : {}),
        },
        select: { id: true, startAt: true, endAt: true, timezoneSnapshot: true, staffMemberId: true },
        orderBy: { id: 'asc' },
        take: 500,
      });
      bookings.push(...page as FutureCalendarBooking[]);
      if (page.length < 500) break;
      cursorId = page.at(-1)?.id;
    }
    return bookings;
  }

  async assertTimeZoneChangeAllowed(scope: BookingScope, tx: TransactionContext, now: Date): Promise<void> {
    assertScope(scope);
    const futureBooking = await tx.appointment.findMany({
      where: { organizationId: scope.organizationId, status: 'CONFIRMED', endAt: { gt: now } },
      select: { id: true },
      take: 1,
    });
    if (futureBooking.length) throw this.timezoneChangeBlocked();

    const [weeklyRule, dayOverride] = await Promise.all([
      tx.calendarWeeklyWindow.findFirst({ where: { organizationId: scope.organizationId }, select: { id: true } }),
      tx.calendarDayOverride.findFirst({ where: { organizationId: scope.organizationId }, select: { id: true } }),
    ]);
    if (weeklyRule || dayOverride) throw this.timezoneChangeBlocked();
  }

  private timezoneChangeBlocked(): ApiError {
    return new ApiError(409, 'TIMEZONE_CHANGE_BLOCKED', 'Resolvé las reservas o revisá los horarios antes de cambiar la zona horaria.');
  }
}
