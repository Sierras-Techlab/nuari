import { describe, expect, it } from 'vitest';
import {
  addElapsedMinutes,
  getLocalDayBounds,
  resolveLocalDateTime,
  resolveLocalDateTimeCandidates,
  resolveLocalBoundary,
  toLocalDateTime,
} from './time-zone-adapter.js';

describe('time zone adapter', () => {
  it('resolves a local date and time to an explicitly tagged UTC instant', () => {
    expect(resolveLocalDateTime({ date: '2027-05-14', time: '16:00', timeZone: 'America/Argentina/Buenos_Aires' }))
      .toEqual({
        instant: '2027-05-14T19:00:00.000Z',
        localDate: '2027-05-14',
        localTime: '16:00',
        offset: '-03:00',
        timeZone: 'America/Argentina/Buenos_Aires',
      });
  });

  it('accepts leap days, midnight, and a time whose appointment began on the previous local day', () => {
    expect(resolveLocalDateTime({ date: '2024-02-29', time: '00:00', timeZone: 'UTC' }).instant)
      .toBe('2024-02-29T00:00:00.000Z');
    const priorDay = resolveLocalDateTime({
      date: '2027-05-14', time: '00:15', timeZone: 'America/Argentina/Buenos_Aires',
    });
    expect(toLocalDateTime('2027-05-14T02:45:00.000Z', 'America/Argentina/Buenos_Aires')).toEqual({
      date: '2027-05-13', time: '23:45', offset: '-03:00', timeZone: 'America/Argentina/Buenos_Aires',
    });
    expect(priorDay.instant).toBe('2027-05-14T03:15:00.000Z');
  });

  it('rejects invalid dates and non-existent local times', () => {
    expect(() => resolveLocalDateTime({ date: '2025-02-29', time: '10:00', timeZone: 'UTC' }))
      .toThrow(expect.objectContaining({ code: 'INVALID_CIVIL_DATETIME' }));
    expect(() => resolveLocalDateTime({ date: '2025-03-09', time: '02:30', timeZone: 'America/New_York' }))
      .toThrow(expect.objectContaining({ code: 'NONEXISTENT_LOCAL_TIME' }));
    expect(() => resolveLocalDateTime({ date: '2011-12-30', time: '12:00', timeZone: 'Pacific/Apia' }))
      .toThrow(expect.objectContaining({ code: 'NONEXISTENT_LOCAL_TIME' }));
  });

  it('requires and validates an explicit offset for a repeated local time', () => {
    const input = { date: '2025-11-02', time: '01:30', timeZone: 'America/New_York' };
    expect(() => resolveLocalDateTime(input))
      .toThrow(expect.objectContaining({ code: 'AMBIGUOUS_LOCAL_TIME' }));
    expect(resolveLocalDateTime({ ...input, offset: '-04:00' }).instant).toBe('2025-11-02T05:30:00.000Z');
    expect(resolveLocalDateTime({ ...input, offset: '-05:00' }).instant).toBe('2025-11-02T06:30:00.000Z');
    expect(() => resolveLocalDateTime({ ...input, offset: '-06:00' }))
      .toThrow(expect.objectContaining({ code: 'OFFSET_DOES_NOT_MATCH_TIME_ZONE' }));
  });

  it('returns both repeated-time candidates and applies early-start/late-end boundaries', () => {
    const input = { date: '2025-11-02', time: '01:30', timeZone: 'America/New_York' };
    expect(resolveLocalDateTimeCandidates(input).map(candidate => candidate.offset)).toEqual(['-04:00', '-05:00']);
    expect(resolveLocalBoundary(input, 'start')?.offset).toBe('-04:00');
    expect(resolveLocalBoundary(input, 'end')?.offset).toBe('-05:00');
    expect(resolveLocalDateTimeCandidates({ ...input, date: '2025-03-09', time: '02:30' })).toEqual([]);
  });

  it('uses real elapsed minutes and formats the resulting instant in the requested zone', () => {
    const start = resolveLocalDateTime({
      date: '2025-03-09', time: '01:30', timeZone: 'America/New_York',
    }).instant;
    const end = addElapsedMinutes(start, 60);
    expect(end).toBe('2025-03-09T07:30:00.000Z');
    expect(toLocalDateTime(end, 'America/New_York')).toEqual({
      date: '2025-03-09', time: '03:30', offset: '-04:00', timeZone: 'America/New_York',
    });
  });

  it('returns actual local day bounds across DST and no bounds for a skipped date', () => {
    const spring = getLocalDayBounds('2025-03-09', 'America/New_York');
    const fall = getLocalDayBounds('2025-11-02', 'America/New_York');
    expect(spring).not.toBeNull();
    expect(fall).not.toBeNull();
    if (!spring || !fall) throw new Error('Expected both local days to exist.');
    expect(spring.endAt.getTime() - spring.startAt.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(fall.endAt.getTime() - fall.startAt.getTime()).toBe(25 * 60 * 60 * 1000);
    expect(getLocalDayBounds('2011-12-30', 'Pacific/Apia')).toBeNull();
  });
});
