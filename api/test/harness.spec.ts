import { describe, expect, it } from 'vitest';
import { isolatedDatabaseEnvironment } from './harness.js';

describe('database test safety boundary', () => {
  it('never falls back to runtime database credentials', () => expect(() => isolatedDatabaseEnvironment({ DATABASE_URL: 'postgresql://ignored@remote.example/production' })).toThrow('TEST_DATABASE_URL'));
  it.each(['postgresql://test@remote.example/nuari_test', 'postgresql://test@127.0.0.1/production', 'postgresql://test@127.0.0.1/nuari_test?schema=other'])('rejects unsafe destination without printing its URL', value => expect(() => isolatedDatabaseEnvironment({ TEST_DATABASE_URL: value, TEST_DIRECT_URL: value })).toThrow('loopback-only'));
  it('accepts explicitly isolated local runtime/migration URLs', () => {
    const value = 'postgresql://test@127.0.0.1:55439/nuari_test?schema=public';
    expect(isolatedDatabaseEnvironment({ TEST_DATABASE_URL: value, TEST_DIRECT_URL: value })).toEqual({ databaseUrl: value, directUrl: value });
  });
  it('accepts the exact confirmed Neon dev endpoint (pooled and direct) only with explicit opt-in', () => {
    const pooled = 'postgresql://u:p@ep-abc-123-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
    const direct = 'postgresql://u:p@ep-abc-123.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
    expect(isolatedDatabaseEnvironment({ TEST_DATABASE_URL: pooled, TEST_DIRECT_URL: direct, TEST_DATABASE_SHARED_DEV_ENDPOINT: 'ep-abc-123' })).toEqual({ databaseUrl: pooled, directUrl: direct });
    expect(() => isolatedDatabaseEnvironment({ TEST_DATABASE_URL: pooled, TEST_DIRECT_URL: direct })).toThrow('loopback-only');
    expect(() => isolatedDatabaseEnvironment({ TEST_DATABASE_URL: pooled, TEST_DIRECT_URL: direct, TEST_DATABASE_SHARED_DEV_ENDPOINT: 'ep-other-999' })).toThrow('loopback-only');
  });
  it('rejects a non-Neon host and mismatched pooled/direct endpoints even with opt-in', () => {
    const remote = 'postgresql://u:p@ep-abc-123.evil.example/neondb';
    expect(() => isolatedDatabaseEnvironment({ TEST_DATABASE_URL: remote, TEST_DIRECT_URL: remote, TEST_DATABASE_SHARED_DEV_ENDPOINT: 'ep-abc-123' })).toThrow('loopback-only');
    const a = 'postgresql://u:p@ep-abc-123-pooler.x.neon.tech/neondb';
    const b = 'postgresql://u:p@ep-abc-1234.x.neon.tech/neondb';
    expect(() => isolatedDatabaseEnvironment({ TEST_DATABASE_URL: a, TEST_DIRECT_URL: b, TEST_DATABASE_SHARED_DEV_ENDPOINT: 'ep-abc-123' })).toThrow();
  });
});
