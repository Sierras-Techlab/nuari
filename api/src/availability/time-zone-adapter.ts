import { Temporal } from '@js-temporal/polyfill';

export type LocalDate = string;
export type LocalTime = string;
export type UtcInstant = string;

export interface LocalDateTimeInput {
  date: LocalDate;
  time: LocalTime;
  timeZone: string;
  /** Required when the civil time occurs twice in this zone. */
  offset?: string;
}

export interface ResolvedLocalDateTime {
  instant: UtcInstant;
  localDate: LocalDate;
  localTime: LocalTime;
  offset: string;
  timeZone: string;
}

export interface LocalDateTimeOutput {
  date: LocalDate;
  time: LocalTime;
  offset: string;
  timeZone: string;
}

export interface LocalDayBounds {
  startAt: Date;
  endAt: Date;
}

export type LocalBoundaryRole = 'start' | 'end';

export class CivilDateTimeError extends RangeError {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'CivilDateTimeError';
  }
}

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseLocalDateTime(input: LocalDateTimeInput): Temporal.PlainDateTime {
  if (!localDatePattern.test(input.date) || !localTimePattern.test(input.time)) {
    throw new CivilDateTimeError('INVALID_CIVIL_DATETIME', 'Expected a valid YYYY-MM-DD date and HH:mm time.');
  }

  try {
    return Temporal.PlainDateTime.from(`${input.date}T${input.time}`, { overflow: 'reject' });
  } catch {
    throw new CivilDateTimeError('INVALID_CIVIL_DATETIME', 'The local date or time is invalid.');
  }
}

function canonicalInstant(instant: Temporal.Instant): UtcInstant {
  return instant.toString({ smallestUnit: 'millisecond' });
}

function asDate(instant: Temporal.Instant): Date {
  return new Date(Number(instant.epochMilliseconds));
}

function asPlainDate(value: LocalDate): Temporal.PlainDate {
  if (!localDatePattern.test(value)) {
    throw new CivilDateTimeError('INVALID_CIVIL_DATE', 'Expected a valid YYYY-MM-DD date.');
  }
  try {
    return Temporal.PlainDate.from(value, { overflow: 'reject' });
  } catch {
    throw new CivilDateTimeError('INVALID_CIVIL_DATE', 'The local date is invalid.');
  }
}

function startOfLocalDate(date: Temporal.PlainDate, timeZone: string): Temporal.ZonedDateTime | null {
  let zoned: Temporal.ZonedDateTime;
  try {
    zoned = date.toZonedDateTime({ timeZone });
  } catch {
    throw new CivilDateTimeError('INVALID_TIME_ZONE', `Invalid IANA time zone: ${timeZone}`);
  }

  // Temporal's compatible disambiguation moves midnight gaps forward. A wholly
  // skipped civil date (for example, Pacific/Apia 2011-12-30) moves to tomorrow.
  return zoned.toPlainDate().equals(date) ? zoned : null;
}

export function resolveLocalDateTime(input: LocalDateTimeInput): ResolvedLocalDateTime {
  const plainDateTime = parseLocalDateTime(input);
  let earlier: Temporal.ZonedDateTime;
  let later: Temporal.ZonedDateTime;

  try {
    earlier = plainDateTime.toZonedDateTime(input.timeZone, { disambiguation: 'earlier' });
    later = plainDateTime.toZonedDateTime(input.timeZone, { disambiguation: 'later' });
  } catch {
    throw new CivilDateTimeError('INVALID_TIME_ZONE', `Invalid IANA time zone: ${input.timeZone}`);
  }

  const earlierMatches = earlier.toPlainDateTime().equals(plainDateTime);
  const laterMatches = later.toPlainDateTime().equals(plainDateTime);
  if (!earlierMatches && !laterMatches) {
    throw new CivilDateTimeError('NONEXISTENT_LOCAL_TIME', 'The local time does not exist in this time zone.');
  }

  const candidates = earlier.epochNanoseconds === later.epochNanoseconds ? [earlier] : [earlier, later];
  let selected: Temporal.ZonedDateTime;

  if (input.offset !== undefined) {
    const matchingCandidate = candidates.find(candidate => candidate.offset === input.offset);
    if (!matchingCandidate) {
      throw new CivilDateTimeError('OFFSET_DOES_NOT_MATCH_TIME_ZONE', 'The supplied offset is not valid for this local time and time zone.');
    }
    selected = matchingCandidate;
  } else {
    if (!earlierMatches || !laterMatches) {
      throw new CivilDateTimeError('NONEXISTENT_LOCAL_TIME', 'The local time does not exist in this time zone.');
    }
    if (candidates.length > 1) {
      throw new CivilDateTimeError('AMBIGUOUS_LOCAL_TIME', 'The local time occurs twice; provide an explicit UTC offset.');
    }
    selected = candidates[0]!;
  }

  return {
    instant: canonicalInstant(selected.toInstant()),
    localDate: selected.toPlainDate().toString(),
    localTime: selected.toPlainTime().toString({ smallestUnit: 'minute' }),
    offset: selected.offset,
    timeZone: input.timeZone,
  };
}

export function resolveLocalDateTimeCandidates(input: Omit<LocalDateTimeInput, 'offset'>): ResolvedLocalDateTime[] {
  const plainDateTime = parseLocalDateTime(input);
  let earlier: Temporal.ZonedDateTime;
  let later: Temporal.ZonedDateTime;
  try {
    earlier = plainDateTime.toZonedDateTime(input.timeZone, { disambiguation: 'earlier' });
    later = plainDateTime.toZonedDateTime(input.timeZone, { disambiguation: 'later' });
  } catch {
    throw new CivilDateTimeError('INVALID_TIME_ZONE', `Invalid IANA time zone: ${input.timeZone}`);
  }
  const matching = [earlier, later].filter(candidate => candidate.toPlainDateTime().equals(plainDateTime));
  const unique = [...new Map(matching.map(candidate => [candidate.epochNanoseconds.toString(), candidate])).values()];
  return unique.map(candidate => ({
    instant: canonicalInstant(candidate.toInstant()),
    localDate: candidate.toPlainDate().toString(),
    localTime: candidate.toPlainTime().toString({ smallestUnit: 'minute' }),
    offset: candidate.offset,
    timeZone: input.timeZone,
  }));
}

/** Resolve a recurrent window edge: earlier start and later end at a repeated time. */
export function resolveLocalBoundary(
  input: Omit<LocalDateTimeInput, 'offset'>,
  role: LocalBoundaryRole,
): ResolvedLocalDateTime | null {
  const candidates = resolveLocalDateTimeCandidates(input);
  if (candidates.length === 0) return null;
  return role === 'start' ? candidates[0]! : candidates[candidates.length - 1]!;
}

export function toLocalDateTime(instant: UtcInstant, timeZone: string): LocalDateTimeOutput {
  try {
    const local = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
    return {
      date: local.toPlainDate().toString(),
      time: local.toPlainTime().toString({ smallestUnit: 'minute' }),
      offset: local.offset,
      timeZone,
    };
  } catch {
    throw new CivilDateTimeError('INVALID_INSTANT_OR_TIME_ZONE', 'The instant or IANA time zone is invalid.');
  }
}

export function addElapsedMinutes(instant: UtcInstant, minutes: number): UtcInstant {
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    throw new RangeError('Elapsed minutes must be a non-negative safe integer.');
  }
  try {
    return canonicalInstant(Temporal.Instant.from(instant).add({ minutes }));
  } catch {
    throw new RangeError('The instant or elapsed minutes are outside the supported range.');
  }
}

export function getLocalDayBounds(date: LocalDate, timeZone: string): LocalDayBounds | null {
  const localDate = asPlainDate(date);
  const start = startOfLocalDate(localDate, timeZone);
  if (!start) return null;

  let end: Temporal.ZonedDateTime | null = null;
  for (let dayOffset = 1; dayOffset <= 370 && !end; dayOffset += 1) {
    const nextDate = localDate.add({ days: dayOffset });
    end = startOfLocalDate(nextDate, timeZone);
  }
  if (!end) throw new CivilDateTimeError('LOCAL_DAY_END_UNAVAILABLE', 'Could not find the next valid local date.');

  return { startAt: asDate(start.toInstant()), endAt: asDate(end.toInstant()) };
}
