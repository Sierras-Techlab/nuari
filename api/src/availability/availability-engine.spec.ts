import { describe, expect, it } from 'vitest';
import { computeAvailability, type AvailabilityCalendar, type AvailabilityEngineInput } from './availability-engine.js';

const date = '2027-05-14';
const business: AvailabilityCalendar = {
  weeklyWindows: [{ weekday: 5, startMinute: 540, endMinute: 1140 }],
  dayOverrides: [],
  timeOff: [],
};

function base(overrides: Partial<AvailabilityEngineInput> = {}): AvailabilityEngineInput {
  return {
    service: { id: 'service-a', durationMinutes: 30, staffSelectionMode: 'CUSTOMER_CHOICE' },
    businessCalendar: business,
    staff: ['staff-a', 'staff-b', 'staff-c'].map(id => ({
      id, name: id, calendar: { weeklyWindows: [{ weekday: 5, startMinute: 540, endMinute: 1140 }], dayOverrides: [], timeOff: [] },
    })),
    busyIntervals: [],
    selection: { kind: 'ANY' },
    fromDate: date,
    toDate: '2027-05-15',
    timeZone: 'America/Argentina/Buenos_Aires',
    slotStepMinutes: 15,
    now: '2027-05-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeAvailability', () => {
  it('intersects business and staff windows and ignores a staff member with an overlapping booking', () => {
    const result = computeAvailability(base({
      staff: [
        { id: 'staff-a', name: 'Max', calendar: { weeklyWindows: [{ weekday: 5, startMinute: 540, endMinute: 1140 }], dayOverrides: [], timeOff: [] } },
        { id: 'staff-b', name: 'Juan', calendar: { weeklyWindows: [{ weekday: 5, startMinute: 540, endMinute: 1140 }], dayOverrides: [], timeOff: [] } },
        { id: 'staff-c', name: 'Pedro', calendar: { weeklyWindows: [{ weekday: 5, startMinute: 540, endMinute: 1140 }], dayOverrides: [], timeOff: [] } },
      ],
      busyIntervals: [{
        id: 'busy-a', serviceId: 'another-service', staffMemberId: 'staff-a', assignmentKind: 'SPECIFIC',
        startAt: new Date('2027-05-14T18:45:00.000Z'), endAt: new Date('2027-05-14T19:15:00.000Z'),
      }],
    }));
    const atFour = result.slots.find(slot => slot.localTime === '16:00');
    expect(atFour?.staff.map(item => item.name)).toEqual(['Juan', 'Pedro']);
  });

  it('requires the whole real-duration interval to fit without crossing a break', () => {
    const calendar: AvailabilityCalendar = {
      weeklyWindows: [
        { weekday: 5, startMinute: 540, endMinute: 970 },
        { weekday: 5, startMinute: 990, endMinute: 1140 },
      ], dayOverrides: [], timeOff: [],
    };
    const result = computeAvailability(base({
      service: { id: 'service-a', durationMinutes: 25, staffSelectionMode: 'NO_ASSIGNMENT' },
      businessCalendar: calendar, staff: [], selection: { kind: 'NONE' }, slotStepMinutes: 15,
    }));
    expect(result.slots.some(slot => slot.localTime === '16:00')).toBe(false);
    expect(result.slots.some(slot => slot.localTime === '16:30')).toBe(true);
  });

  it('offers both repeated-hour offsets and omits a spring-forward gap', () => {
    const dstBusiness: AvailabilityCalendar = {
      weeklyWindows: [{ weekday: 7, startMinute: 60, endMinute: 240 }], dayOverrides: [], timeOff: [],
    };
    const staffCalendar = { weeklyWindows: [{ weekday: 7, startMinute: 60, endMinute: 240 }], dayOverrides: [], timeOff: [] };
    const spring = computeAvailability(base({
      service: { id: 'service-a', durationMinutes: 5, staffSelectionMode: 'CUSTOMER_CHOICE' },
      businessCalendar: dstBusiness,
      staff: [{ id: 'staff-a', name: 'A', calendar: staffCalendar }],
      fromDate: '2025-03-09', toDate: '2025-03-10', timeZone: 'America/New_York',
      slotStepMinutes: 30, now: '2025-03-09T00:00:00.000Z',
    }));
    expect(spring.slots.some(slot => slot.localTime === '02:00' || slot.localTime === '02:30')).toBe(false);

    const fall = computeAvailability(base({
      service: { id: 'service-a', durationMinutes: 5, staffSelectionMode: 'CUSTOMER_CHOICE' },
      businessCalendar: dstBusiness,
      staff: [{ id: 'staff-a', name: 'A', calendar: staffCalendar }],
      fromDate: '2025-11-02', toDate: '2025-11-03', timeZone: 'America/New_York',
      slotStepMinutes: 30, now: '2025-11-02T00:00:00.000Z',
    }));
    expect(fall.slots.filter(slot => slot.localTime === '01:30').map(slot => slot.offset)).toEqual(['-04:00', '-05:00']);
  });

  it('returns no slots for a skipped civil date and honors the day override over weekly windows', () => {
    const apia = computeAvailability(base({
      service: { id: 'service-a', durationMinutes: 5, staffSelectionMode: 'NO_ASSIGNMENT' },
      businessCalendar: { weeklyWindows: [{ weekday: 5, startMinute: 540, endMinute: 600 }], dayOverrides: [], timeOff: [] },
      staff: [], selection: { kind: 'NONE' }, fromDate: '2011-12-30', toDate: '2011-12-31',
      timeZone: 'Pacific/Apia', now: '2011-12-29T00:00:00.000Z',
    }));
    expect(apia.slots).toEqual([]);

    const closed = computeAvailability(base({
      service: { id: 'service-a', durationMinutes: 5, staffSelectionMode: 'NO_ASSIGNMENT' },
      businessCalendar: {
        weeklyWindows: [{ weekday: 5, startMinute: 540, endMinute: 600 }],
        dayOverrides: [{ localDate: date, windows: [] }], timeOff: [],
      },
      staff: [], selection: { kind: 'NONE' },
    }));
    expect(closed.slots).toEqual([]);
  });

  it('uses local date ranges, fixed clock boundaries, strict modes, and bound cursors', () => {
    const input = base({
      service: { id: 'service-a', durationMinutes: 5, staffSelectionMode: 'NO_ASSIGNMENT' },
      staff: [], selection: { kind: 'NONE' }, limit: 1,
    });
    const first = computeAvailability(input);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();
    const second = computeAvailability({ ...input, cursor: first.nextCursor! });
    expect(second.slots[0]?.startAt).not.toBe(first.slots[0]?.startAt);
    expect(() => computeAvailability({ ...input, selection: { kind: 'ANY' } })).toThrow();
    expect(() => computeAvailability({ ...input, toDate: '2027-05-23' })).toThrow();
    expect(() => computeAvailability({ ...input, cursor: first.nextCursor!, slotStepMinutes: 30 })).toThrow();
  });
});
