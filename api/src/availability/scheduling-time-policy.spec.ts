import { describe, expect, it } from 'vitest';
import {
  isPublicBookingAllowed,
  isPublicCancellationAllowed,
  DEFAULT_SCHEDULING_TIME_POLICY,
  validateSchedulingTimePolicy,
  type Clock,
  type SchedulingTimePolicy,
} from './scheduling-time-policy.js';

const policy: SchedulingTimePolicy = {
  slotStepMinutes: 15,
  publicMinNoticeMinutes: 120,
  publicMaxAdvanceDays: 60,
  publicCancelNoticeMinutes: 120,
};

function fixedClock(instant: string): Clock {
  return { now: () => instant };
}

describe('scheduling time policy', () => {
  it('uses the documented initial defaults', () => {
    expect(DEFAULT_SCHEDULING_TIME_POLICY).toEqual({
      slotStepMinutes: 15,
      publicMinNoticeMinutes: 120,
      publicMaxAdvanceDays: 60,
      publicCancelNoticeMinutes: 120,
    });
  });

  it('checks elapsed-minute notice inclusively and the local date horizon inclusively', () => {
    const clock = fixedClock('2025-01-01T12:00:00.000Z');
    expect(isPublicBookingAllowed({
      startAt: '2025-01-01T14:00:00.000Z', timeZone: 'UTC', policy, clock,
    })).toBe(true);
    expect(isPublicBookingAllowed({
      startAt: '2025-01-01T13:59:59.999Z', timeZone: 'UTC', policy, clock,
    })).toBe(false);
    expect(isPublicBookingAllowed({
      startAt: '2025-03-02T23:59:00.000Z', timeZone: 'UTC', policy: { ...policy, publicMaxAdvanceDays: 60 }, clock,
    })).toBe(true);
    expect(isPublicBookingAllowed({
      startAt: '2025-03-03T00:00:00.000Z', timeZone: 'UTC', policy: { ...policy, publicMaxAdvanceDays: 60 }, clock,
    })).toBe(false);
  });

  it('compares the horizon using the business date, including across DST', () => {
    const clock = fixedClock('2025-03-09T04:30:00.000Z');
    const oneDay = { ...policy, publicMinNoticeMinutes: 0, publicMaxAdvanceDays: 1 };
    expect(isPublicBookingAllowed({
      startAt: '2025-03-10T03:59:00.000Z', timeZone: 'America/New_York', policy: oneDay, clock,
    })).toBe(true);
    expect(isPublicBookingAllowed({
      startAt: '2025-03-10T04:00:00.000Z', timeZone: 'America/New_York', policy: oneDay, clock,
    })).toBe(false);
  });

  it('honors the cancellation cutoff inclusively and never allows a started appointment', () => {
    const clock = fixedClock('2025-01-01T12:00:00.000Z');
    expect(isPublicCancellationAllowed({ startAt: '2025-01-01T14:00:00.000Z', policy, clock })).toBe(true);
    expect(isPublicCancellationAllowed({ startAt: '2025-01-01T13:59:59.999Z', policy, clock })).toBe(false);
    expect(isPublicCancellationAllowed({
      startAt: '2025-01-01T12:01:00.000Z', policy: { ...policy, publicCancelNoticeMinutes: 0 }, clock,
    })).toBe(true);
    expect(isPublicCancellationAllowed({
      startAt: '2025-01-01T12:00:00.000Z', policy: { ...policy, publicCancelNoticeMinutes: 0 }, clock,
    })).toBe(false);
  });

  it('accepts only the documented numeric boundaries without coercion', () => {
    expect(() => validateSchedulingTimePolicy({
      ...policy, publicMinNoticeMinutes: 0, publicCancelNoticeMinutes: 43_200, publicMaxAdvanceDays: 365,
    })).not.toThrow();
    expect(() => validateSchedulingTimePolicy({
      ...policy, slotStepMinutes: 5, publicMinNoticeMinutes: 43_200, publicCancelNoticeMinutes: 0,
      publicMaxAdvanceDays: 1,
    })).not.toThrow();

    for (const invalid of [
      { ...policy, slotStepMinutes: 20 },
      { ...policy, slotStepMinutes: 60 },
      { ...policy, publicMinNoticeMinutes: -1 },
      { ...policy, publicMinNoticeMinutes: 43_201 },
      { ...policy, publicCancelNoticeMinutes: 43_201 },
      { ...policy, publicMaxAdvanceDays: 0 },
      { ...policy, publicMaxAdvanceDays: 366 },
      { ...policy, publicMaxAdvanceDays: 1.5 },
      { ...policy, publicMinNoticeMinutes: '120' },
      { ...policy, publicCancelNoticeMinutes: null },
      { ...policy, publicMaxAdvanceDays: true },
    ]) {
      expect(() => validateSchedulingTimePolicy(invalid)).toThrow();
    }
  });
});
