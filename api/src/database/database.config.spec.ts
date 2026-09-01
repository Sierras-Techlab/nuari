import { describe, expect, it } from 'vitest';

import { getDatabaseUrl } from './database.config.js';

describe('getDatabaseUrl', () => {
  it('returns the pooled runtime URL', () => {
    expect(
      getDatabaseUrl({
        DATABASE_URL: 'postgresql://pooled.example/nuari?sslmode=require',
      }),
    ).toBe('postgresql://pooled.example/nuari?sslmode=require');
  });

  it('trims surrounding whitespace', () => {
    expect(
      getDatabaseUrl({
        DATABASE_URL: '  postgresql://pooled.example/nuari  ',
      }),
    ).toBe('postgresql://pooled.example/nuari');
  });

  it('rejects a missing runtime URL', () => {
    expect(() => getDatabaseUrl({})).toThrow('DATABASE_URL');
  });
});
