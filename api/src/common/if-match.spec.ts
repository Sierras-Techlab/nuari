import { describe, expect, it } from 'vitest';
import { parseIfMatch } from './if-match.js';

describe('parseIfMatch', () => {
  it('returns a positive safe integer version from a quoted ETag', () => {
    expect(parseIfMatch('"17"')).toBe(17);
  });

  it('requires an If-Match precondition', () => {
    expect(() => parseIfMatch(undefined)).toThrow(expect.objectContaining({
      status: 428,
      response: expect.objectContaining({ code: 'PRECONDITION_REQUIRED' }),
    }));
  });

  it.each(['', '17', '"0"', '"01"', 'W/"1"', '"1", "2"', '"9007199254740992"'])('rejects malformed or unsafe versions: %s', value => {
    expect(() => parseIfMatch(value)).toThrow(expect.objectContaining({
      status: 400,
      response: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    }));
  });
});
