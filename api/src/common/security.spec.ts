import 'reflect-metadata';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { CsrfService } from './csrf.js';
import { SecurityConfig, validateOrigin } from './security.config.js';
import { AuthCookies } from './cookies.js';
import { MutableClock } from '../../test/harness.js';
import { randomToken, sha256 } from './crypto.js';

const request = (token: string, session?: string, origin = 'http://localhost:3000'): Request => ({
  cookies: { nuari_csrf: token, nuari_session: session }, headers: { 'content-length': '2' },
  get: (name: string) => ({ origin, 'x-csrf-token': token, 'sec-fetch-site': 'same-origin' })[name],
  is: () => 'application/json',
}) as unknown as Request;
afterEach(() => vi.unstubAllEnvs());
describe('signed CSRF', () => {
  it('binds a signed opaque token without serializing the session hash', () => {
    const config = new SecurityConfig();
    const csrf = new CsrfService(config, new MutableClock(new Date('2026-10-12T12:00:00Z')));
    const session = randomToken();
    const token = csrf.issue(session);
    expect(token).not.toContain(session);
    expect(token).not.toContain(sha256(session));
    expect(() => csrf.verify(request(token, session))).not.toThrow();
    expect(() => csrf.verify(request(token, randomToken()))).toThrow();
    expect(() => csrf.verify(request(token))).toThrow();
  });
  it('expires at exact TTL and rejects tampering', () => {
    const clock = new MutableClock(new Date('2026-10-12T12:00:00Z'));
    const csrf = new CsrfService(new SecurityConfig(), clock);
    const token = csrf.issue();
    expect(() => csrf.verify(request(token))).not.toThrow();
    expect(() => csrf.verify(request(token.slice(0, -1) + '!'))).toThrow();
    clock.advance(3_600_000);
    expect(() => csrf.verify(request(token))).toThrow();
  });
  it.each(['null', '', 'https://evil.test'])('rejects origin %s', origin => {
    const csrf = new CsrfService(new SecurityConfig(), new MutableClock());
    expect(() => csrf.verify(request(csrf.issue(), undefined, origin))).toThrow();
  });
});
describe('configuration and cookies', () => {
  it.each(['https://example.test/path', 'https://example.test/?query', 'https://example.test/#hash', 'https://user:password@example.test', 'file:///etc', '*'])('rejects invalid origin %s', value => expect(() => validateOrigin(value, false)).toThrow());
  it('rejects HTTP production origin', () => expect(() => validateOrigin('http://example.test', true)).toThrow());
  it('rejects globally trusted proxies', () => {
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '0.0.0.0/0');
    expect(() => new SecurityConfig()).toThrow();
  });
  it('sets host-only HttpOnly local cookies and equivalent clearing attributes', () => {
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };
    const cookies = new AuthCookies(new SecurityConfig());
    cookies.session(response as unknown as Response, randomToken(), 1000);
    cookies.clear(response as unknown as Response);
    expect(response.cookie).toHaveBeenCalledWith('nuari_session', expect.any(String), { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 1000 });
    expect(response.clearCookie).toHaveBeenCalledWith('nuari_session', { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
  });
});
