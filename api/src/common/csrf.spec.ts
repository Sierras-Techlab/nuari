import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { CsrfService } from './csrf.js';

const now = new Date('2026-10-12T12:00:00.000Z');
const clock = { now: () => now };
const config = { csrfSecret: 'a'.repeat(32), webOrigin: 'http://localhost:3000', sessionCookie: 'nuari_session', csrfCookie: 'nuari_csrf' };

function request(token: string, session?: string): Request {
  const headers: Record<string, string> = { origin: 'http://localhost:3000', 'x-csrf-token': token, 'content-type': 'application/json', 'content-length': '2' };
  return {
    headers,
    cookies: { nuari_csrf: token, ...(session ? { nuari_session: session } : {}) },
    get(name: string) { return headers[name.toLowerCase()]; },
    is(type: string) { return type === 'application/json'; },
  } as unknown as Request;
}

describe('CsrfService', () => {
  it('accepts a signed token only in the session context for which it was issued', () => {
    const service = new CsrfService(config as never, clock as never);
    const session = 'S'.repeat(43);
    const token = service.issue(session);
    expect(() => service.verify(request(token, session))).not.toThrow();
    expect(() => service.verify(request(token, 'T'.repeat(43)))).toThrow();
  });

  it('rejects a foreign origin and an expired token', () => {
    const service = new CsrfService(config as never, clock as never);
    const token = service.issue();
    const foreign = request(token);
    foreign.headers.origin = 'https://attacker.invalid';
    expect(() => service.verify(foreign)).toThrow();

    const expiredClock = { now: () => new Date(now.getTime() + 3_600_000) };
    const expiredService = new CsrfService(config as never, expiredClock as never);
    expect(() => expiredService.verify(request(token))).toThrow();
  });
});
