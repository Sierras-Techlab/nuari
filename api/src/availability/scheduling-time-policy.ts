import { Temporal } from '@js-temporal/polyfill';
import type { UtcInstant } from './time-zone-adapter.js';

export interface SchedulingTimePolicy {
  slotStepMinutes: number;
  publicMinNoticeMinutes: number;
  publicMaxAdvanceDays: number;
  publicCancelNoticeMinutes: number;
}

export const DEFAULT_SCHEDULING_TIME_POLICY: SchedulingTimePolicy = {
  slotStepMinutes: 15,
  publicMinNoticeMinutes: 120,
  publicMaxAdvanceDays: 60,
  publicCancelNoticeMinutes: 120,
};

export interface Clock {
  now(): UtcInstant;
}

export interface PublicBookingDecisionInput {
  startAt: UtcInstant;
  timeZone: string;
  policy: SchedulingTimePolicy;
  clock: Clock;
}

export interface PublicCancellationDecisionInput {
  startAt: UtcInstant;
  policy: SchedulingTimePolicy;
  clock: Clock;
}

const supportedSlotSteps = new Set([5, 10, 15, 30]);
const maxNoticeMinutes = 43_200;

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

export function validateSchedulingTimePolicy(value: unknown): asserts value is SchedulingTimePolicy {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Scheduling time policy must be an object.');
  }
  const policy = value as Partial<Record<keyof SchedulingTimePolicy, unknown>>;
  if (!isIntegerInRange(policy.slotStepMinutes, 5, 30) || !supportedSlotSteps.has(policy.slotStepMinutes)) {
    throw new RangeError('slotStepMinutes must be one of 5, 10, 15, or 30.');
  }
  if (!isIntegerInRange(policy.publicMinNoticeMinutes, 0, maxNoticeMinutes)) {
    throw new RangeError('publicMinNoticeMinutes must be an integer from 0 through 43200.');
  }
  if (!isIntegerInRange(policy.publicCancelNoticeMinutes, 0, maxNoticeMinutes)) {
    throw new RangeError('publicCancelNoticeMinutes must be an integer from 0 through 43200.');
  }
  if (!isIntegerInRange(policy.publicMaxAdvanceDays, 1, 365)) {
    throw new RangeError('publicMaxAdvanceDays must be an integer from 1 through 365.');
  }
}

export function isPublicBookingAllowed(input: PublicBookingDecisionInput): boolean {
  validateSchedulingTimePolicy(input.policy);
  const now = Temporal.Instant.from(input.clock.now());
  const start = Temporal.Instant.from(input.startAt);
  if (Temporal.Instant.compare(start, now) < 0) return false;

  const earliest = now.add({ minutes: input.policy.publicMinNoticeMinutes });
  if (Temporal.Instant.compare(start, earliest) < 0) return false;

  const localToday = now.toZonedDateTimeISO(input.timeZone).toPlainDate();
  const lastAllowedLocalDate = localToday.add({ days: input.policy.publicMaxAdvanceDays });
  const startLocalDate = start.toZonedDateTimeISO(input.timeZone).toPlainDate();
  return Temporal.PlainDate.compare(startLocalDate, lastAllowedLocalDate) <= 0;
}

export function isPublicCancellationAllowed(input: PublicCancellationDecisionInput): boolean {
  validateSchedulingTimePolicy(input.policy);
  const now = Temporal.Instant.from(input.clock.now());
  const start = Temporal.Instant.from(input.startAt);
  if (Temporal.Instant.compare(start, now) <= 0) return false;

  const remainingNanoseconds = start.epochNanoseconds - now.epochNanoseconds;
  const requiredNanoseconds = BigInt(input.policy.publicCancelNoticeMinutes) * 60_000_000_000n;
  return remainingNanoseconds >= requiredNanoseconds;
}
