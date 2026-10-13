import { describe, expect, it } from 'vitest';
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, sessionValid } from './session-policy.js';

const now = new Date('2026-10-12T12:00:00Z');
const session = { credentialVersion: 2, revokedAt: null, expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS), lastSeenAt: now };
describe('session policy', () => {
  it('accepts matching version within both limits', () => expect(sessionValid(session, 2, now)).toBe(true));
  it('denies version mismatch', () => expect(sessionValid(session, 3, now)).toBe(false));
  it('denies revocation', () => expect(sessionValid({ ...session, revokedAt: now }, 2, now)).toBe(false));
  it('denies exactly at absolute expiry even after recent activity', () => expect(sessionValid({ ...session, lastSeenAt: session.expiresAt }, 2, session.expiresAt)).toBe(false));
  it('denies exactly at idle expiry', () => expect(sessionValid(session, 2, new Date(now.getTime() + SESSION_IDLE_MS))).toBe(false));
  it('accepts one millisecond before idle expiry', () => expect(sessionValid(session, 2, new Date(now.getTime() + SESSION_IDLE_MS - 1))).toBe(true));
});
