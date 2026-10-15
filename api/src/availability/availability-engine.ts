import { Temporal } from '@js-temporal/polyfill';
import {
  addElapsedMinutes, resolveLocalBoundary, resolveLocalDateTimeCandidates,
  type UtcInstant,
} from './time-zone-adapter.js';

export interface AvailabilityWindow {
  startMinute: number;
  endMinute: number;
  weekday?: number;
}

export interface AvailabilityOverride {
  localDate: string;
  windows: AvailabilityWindow[];
}

export interface AvailabilityTimeOff {
  startAt: Date;
  endAt: Date;
}

export interface AvailabilityCalendar {
  weeklyWindows: AvailabilityWindow[];
  dayOverrides: AvailabilityOverride[];
  timeOff: AvailabilityTimeOff[];
}

export interface AvailabilityServiceInput {
  id: string;
  durationMinutes: number;
  staffSelectionMode: 'CUSTOMER_CHOICE' | 'AUTO_ASSIGN' | 'NO_ASSIGNMENT';
}

export interface AvailabilityStaffInput {
  id: string;
  name: string;
  calendar: AvailabilityCalendar | null;
}

export interface AvailabilityBusyInterval {
  id: string;
  serviceId: string;
  staffMemberId: string | null;
  assignmentKind: 'SPECIFIC' | 'ANY' | 'NONE';
  startAt: Date;
  endAt: Date;
}

export type AvailabilitySelection =
  | { kind: 'SPECIFIC'; staffMemberId: string }
  | { kind: 'ANY' }
  | { kind: 'NONE' };

export interface AvailabilityEngineInput {
  service: AvailabilityServiceInput;
  businessCalendar: AvailabilityCalendar | null;
  staff: readonly AvailabilityStaffInput[];
  busyIntervals: readonly AvailabilityBusyInterval[];
  selection: AvailabilitySelection;
  fromDate: string;
  toDate: string;
  timeZone: string;
  slotStepMinutes: number;
  now: UtcInstant;
  at?: UtcInstant;
  limit?: number;
  cursor?: string;
}

export interface AvailableSlot {
  startAt: UtcInstant;
  endAt: UtcInstant;
  localDate: string;
  localTime: string;
  offset: string;
  timeZone: string;
  staff: Array<{ id: string; name: string }>;
}

export interface AvailabilityEngineResult {
  slots: AvailableSlot[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface Interval {
  start: number;
  end: number;
}

interface CursorPayload {
  afterStartAt: string;
  afterStaffId: string;
  serviceId: string;
  fromDate: string;
  toDate: string;
  selection: string;
  timeZone: string;
  slotStepMinutes: number;
  durationMinutes: number;
  serviceSelectionMode: AvailabilityServiceInput['staffSelectionMode'];
  staffIds: string;
  at: string | null;
}

function parseDate(value: string): Temporal.PlainDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Availability dates must use YYYY-MM-DD.');
  try {
    const date = Temporal.PlainDate.from(value, { overflow: 'reject' });
    if (date.toString() !== value) throw new RangeError('Invalid local date.');
    return date;
  } catch {
    throw new RangeError('Availability contains an invalid local date.');
  }
}

function minuteTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function expandCalendarDay(calendar: AvailabilityCalendar, date: Temporal.PlainDate, timeZone: string): Interval[] {
  const dateString = date.toString();
  const override = calendar.dayOverrides.find(item => item.localDate === dateString);
  const windows = override ? override.windows : calendar.weeklyWindows.filter(item => item.weekday === date.dayOfWeek);
  const intervals: Interval[] = [];
  for (const window of windows) {
    if (window.startMinute < 0 || window.startMinute > 1439 || window.endMinute < 1 || window.endMinute > 1440 || window.startMinute >= window.endMinute) continue;
    const start = resolveLocalBoundary({ date: dateString, time: minuteTime(window.startMinute), timeZone }, 'start');
    const endDate = window.endMinute === 1440 ? date.add({ days: 1 }).toString() : dateString;
    const endTime = window.endMinute === 1440 ? '00:00' : minuteTime(window.endMinute);
    const end = resolveLocalBoundary({ date: endDate, time: endTime, timeZone }, 'end');
    if (!start || !end) continue;
    const startMs = Date.parse(start.instant);
    const endMs = Date.parse(end.instant);
    if (endMs > startMs) intervals.push({ start: startMs, end: endMs });
  }
  return mergeIntervals(intervals);
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].filter(item => item.end > item.start).sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Interval[] = [];
  for (const current of sorted) {
    const previous = merged.at(-1);
    if (previous && current.start <= previous.end) previous.end = Math.max(previous.end, current.end);
    else merged.push({ ...current });
  }
  return merged;
}

function intersectIntervals(left: readonly Interval[], right: readonly Interval[]): Interval[] {
  const intersections: Interval[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const a = left[leftIndex]!;
    const b = right[rightIndex]!;
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    if (end > start) intersections.push({ start, end });
    if (a.end <= b.end) leftIndex += 1;
    else rightIndex += 1;
  }
  return intersections;
}

function subtractIntervals(source: readonly Interval[], removals: readonly Interval[]): Interval[] {
  let remaining = mergeIntervals(source);
  for (const removal of mergeIntervals(removals)) {
    const next: Interval[] = [];
    for (const interval of remaining) {
      if (removal.end <= interval.start || removal.start >= interval.end) {
        next.push(interval);
        continue;
      }
      if (removal.start > interval.start) next.push({ start: interval.start, end: removal.start });
      if (removal.end < interval.end) next.push({ start: removal.end, end: interval.end });
    }
    remaining = next;
  }
  return remaining;
}

function calendarIntervals(calendar: AvailabilityCalendar, from: Temporal.PlainDate, through: Temporal.PlainDate, timeZone: string): Interval[] {
  const result: Interval[] = [];
  for (let date = from; Temporal.PlainDate.compare(date, through) <= 0; date = date.add({ days: 1 })) {
    result.push(...expandCalendarDay(calendar, date, timeZone));
  }
  return mergeIntervals(result);
}

function timeOffIntervals(...calendars: Array<AvailabilityCalendar | null>): Interval[] {
  return calendars.flatMap(calendar => calendar?.timeOff.map(item => ({
    start: item.startAt.getTime(), end: item.endAt.getTime(),
  })) ?? []);
}

function readCursor(input: AvailabilityEngineInput, selectionKey: string): CursorPayload | null {
  if (!input.cursor) return null;
  try {
    const payload = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')) as CursorPayload;
    const staffIds = input.staff.map(staff => staff.id).sort().join(',');
    if (payload.serviceId !== input.service.id || payload.fromDate !== input.fromDate || payload.toDate !== input.toDate || payload.selection !== selectionKey ||
      payload.timeZone !== input.timeZone || payload.slotStepMinutes !== input.slotStepMinutes || payload.durationMinutes !== input.service.durationMinutes ||
      payload.serviceSelectionMode !== input.service.staffSelectionMode || payload.staffIds !== staffIds ||
      payload.at !== (input.at ?? null) ||
      typeof payload.afterStartAt !== 'string' || typeof payload.afterStaffId !== 'string') throw new Error('Cursor filters differ.');
    return payload;
  } catch {
    throw new RangeError('The availability cursor is invalid or belongs to different filters.');
  }
}

function cursorFor(slot: AvailableSlot, input: AvailabilityEngineInput, selectionKey: string): string {
  const payload: CursorPayload = {
    afterStartAt: slot.startAt,
    afterStaffId: slot.staff[0]?.id ?? '',
    serviceId: input.service.id,
    fromDate: input.fromDate,
    toDate: input.toDate,
    selection: selectionKey,
    timeZone: input.timeZone,
    slotStepMinutes: input.slotStepMinutes,
    durationMinutes: input.service.durationMinutes,
    serviceSelectionMode: input.service.staffSelectionMode,
    staffIds: input.staff.map(staff => staff.id).sort().join(','),
    at: input.at ?? null,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function afterCursor(slot: AvailableSlot, cursor: CursorPayload): boolean {
  if (slot.startAt !== cursor.afterStartAt) return slot.startAt > cursor.afterStartAt;
  return (slot.staff[0]?.id ?? '') > cursor.afterStaffId;
}

function selectionKey(selection: AvailabilitySelection): string {
  return selection.kind === 'SPECIFIC' ? `SPECIFIC:${selection.staffMemberId}` : selection.kind;
}

export function computeAvailability(input: AvailabilityEngineInput): AvailabilityEngineResult {
  const fromDate = parseDate(input.fromDate);
  const toDate = parseDate(input.toDate);
  const dayCount = fromDate.until(toDate, { largestUnit: 'day' }).days;
  if (dayCount < 1 || dayCount > 7) throw new RangeError('Availability queries must cover one to seven local days.');
  if (!Number.isInteger(input.slotStepMinutes) || ![5, 10, 15, 30].includes(input.slotStepMinutes)) throw new RangeError('Unsupported slot step.');
  if (!Number.isInteger(input.service.durationMinutes) || input.service.durationMinutes < 5 || input.service.durationMinutes > 720) throw new RangeError('Service duration is invalid.');

  const mode = input.service.staffSelectionMode;
  if ((mode === 'NO_ASSIGNMENT' && input.selection.kind !== 'NONE') ||
    (mode === 'AUTO_ASSIGN' && input.selection.kind !== 'ANY') ||
    (mode === 'CUSTOMER_CHOICE' && input.selection.kind === 'NONE')) {
    throw new RangeError('The requested selection does not match the service mode.');
  }

  const startDate = fromDate.subtract({ days: 1 });
  const throughDate = toDate.add({ days: 1 });
  const business = input.businessCalendar ? calendarIntervals(input.businessCalendar, startDate, throughDate, input.timeZone) : [];
  const selectedStaffMemberId = input.selection.kind === 'SPECIFIC' ? input.selection.staffMemberId : undefined;
  const candidates = input.selection.kind === 'NONE'
    ? [{ id: null, name: null, calendar: null }]
    : input.selection.kind === 'SPECIFIC'
      ? input.staff.filter(staff => staff.id === selectedStaffMemberId).map(staff => ({ id: staff.id, name: staff.name, calendar: staff.calendar }))
      : input.staff.map(staff => ({ id: staff.id, name: staff.name, calendar: staff.calendar }));

  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new RangeError('The availability clock instant is invalid.');
  const slotMap = new Map<string, AvailableSlot>();
  for (const candidate of candidates) {
    if (candidate.id !== null && !candidate.calendar) continue;
    const staffIntervals = candidate.calendar
      ? calendarIntervals(candidate.calendar, startDate, throughDate, input.timeZone)
      : business;
    let free = candidate.calendar ? intersectIntervals(business, staffIntervals) : [...business];
    free = subtractIntervals(free, timeOffIntervals(input.businessCalendar, candidate.calendar));
    const candidateBusy = input.busyIntervals.filter(interval => {
      if (input.selection.kind === 'NONE') return interval.assignmentKind === 'NONE' && interval.serviceId === input.service.id;
      return interval.staffMemberId === candidate.id;
    });
    free = subtractIntervals(free, candidateBusy.map(interval => ({ start: interval.startAt.getTime(), end: interval.endAt.getTime() })));

    for (let date = fromDate; Temporal.PlainDate.compare(date, toDate) < 0; date = date.add({ days: 1 })) {
      for (let minute = 0; minute < 1440; minute += input.slotStepMinutes) {
        const time = minuteTime(minute);
        const starts = resolveLocalDateTimeCandidates({ date: date.toString(), time, timeZone: input.timeZone });
        for (const resolved of starts) {
          if (input.at !== undefined && resolved.instant !== input.at) continue;
          const startAtMs = Date.parse(resolved.instant);
          if (startAtMs < nowMs) continue;
          const endAt = addElapsedMinutes(resolved.instant, input.service.durationMinutes);
          const endAtMs = Date.parse(endAt);
          if (!free.some(interval => startAtMs >= interval.start && endAtMs <= interval.end)) continue;
          const key = resolved.instant;
          const slot = slotMap.get(key) ?? {
            startAt: resolved.instant,
            endAt,
            localDate: resolved.localDate,
            localTime: resolved.localTime,
            offset: resolved.offset,
            timeZone: input.timeZone,
            staff: [],
          };
          if (candidate.id !== null) slot.staff.push({ id: candidate.id, name: candidate.name! });
          slotMap.set(key, slot);
        }
      }
    }
  }

  const allSlots = [...slotMap.values()].sort((left, right) => left.startAt.localeCompare(right.startAt) || (left.staff[0]?.id ?? '').localeCompare(right.staff[0]?.id ?? ''));
  const key = selectionKey(input.selection);
  const cursor = readCursor(input, key);
  const eligible = cursor ? allSlots.filter(slot => afterCursor(slot, cursor)) : allSlots;
  const limit = input.limit ?? 2_000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 2_000) throw new RangeError('Availability page limit must be from 1 through 2000.');
  const hasMore = eligible.length > limit;
  const slots = eligible.slice(0, limit);
  return { slots, hasMore, nextCursor: hasMore && slots.length ? cursorFor(slots[slots.length - 1]!, input, key) : null };
}
