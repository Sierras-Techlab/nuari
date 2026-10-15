import { describe, expect, it, vi } from 'vitest';
import { CalendarService } from './calendar.service.js';

const now = new Date('2025-01-01T00:00:00.000Z');
const scope = { organizationId: 'tenant-a' };

function setup(futureBookings: object[] = []) {
  const calendar = { id: 'calendar-a', organizationId: scope.organizationId, kind: 'BUSINESS', version: 3 };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: scope.organizationId }]),
    bookingCalendar: {
      findFirst: vi.fn().mockResolvedValue(calendar),
      update: vi.fn().mockResolvedValue({ ...calendar, version: 4 }),
    },
    calendarWeeklyWindow: { deleteMany: vi.fn(), createMany: vi.fn() },
    calendarDayOverride: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    calendarTimeOff: { create: vi.fn().mockResolvedValue({ id: 'time-off-a' }) },
    organization: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
  };
  const db = { $transaction: vi.fn((callback: (tx: never) => unknown) => callback(tx as never)) };
  const read = { listFutureBookingsForCalendar: vi.fn().mockResolvedValue(futureBookings) };
  const clock = { now: vi.fn().mockReturnValue(now) };
  return { service: new CalendarService(db as never, read as never, clock as never), tx, read, db };
}

describe('CalendarService', () => {
  it('rejects overlapping weekly windows before starting a transaction', async () => {
    const { service, db } = setup();
    await expect(service.replaceWeeklyWindows(scope, 'calendar-a', {
      windows: [
        { weekday: 1, startMinute: 540, endMinute: 700 },
        { weekday: 1, startMinute: 699, endMinute: 780 },
      ],
    }, 3)).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects incompatible weekly changes atomically when a confirmed booking would lose coverage', async () => {
    const booking = {
      id: 'booking-a',
      startAt: new Date('2025-01-06T14:00:00.000Z'),
      endAt: new Date('2025-01-06T14:30:00.000Z'),
      timezoneSnapshot: 'UTC',
      staffMemberId: null,
    };
    const { service, tx } = setup([booking]);
    await expect(service.replaceWeeklyWindows(scope, 'calendar-a', {
      windows: [{ weekday: 1, startMinute: 600, endMinute: 700 }],
    }, 3)).rejects.toMatchObject({ response: { code: 'SCHEDULE_HAS_BOOKINGS' } });
    expect(tx.calendarWeeklyWindow.deleteMany).not.toHaveBeenCalled();
    expect(tx.bookingCalendar.update).not.toHaveBeenCalled();
  });

  it('does not create time off that overlaps a confirmed booking', async () => {
    const booking = {
      id: 'booking-a',
      startAt: new Date('2025-01-06T14:00:00.000Z'),
      endAt: new Date('2025-01-06T14:30:00.000Z'),
      timezoneSnapshot: 'UTC',
      staffMemberId: null,
    };
    const { service, tx } = setup([booking]);
    await expect(service.createTimeOff(scope, 'calendar-a', {
      startAt: '2025-01-06T14:15:00.000Z',
      endAt: '2025-01-06T15:00:00.000Z',
      reasonCode: 'BUSINESS_CLOSED',
    }, 3)).rejects.toMatchObject({ response: { code: 'SCHEDULE_HAS_BOOKINGS' } });
    expect(tx.calendarTimeOff.create).not.toHaveBeenCalled();
    expect(tx.bookingCalendar.update).not.toHaveBeenCalled();
  });
});
