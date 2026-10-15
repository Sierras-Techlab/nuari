import { describe, expect, it } from 'vitest';
import { deriveManagementToken, hashManagementToken, matchesManagementToken } from './management-token.js';

describe('public management token', () => {
  const secret = 's'.repeat(32);
  it('derives a 256-bit bearer bound to organization, appointment and version', () => {
    const token = deriveManagementToken(secret, 'org-a', 'appointment-a', 1);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveManagementToken(secret, 'org-a', 'appointment-a', 1)).toBe(token);
    expect(deriveManagementToken(secret, 'org-b', 'appointment-a', 1)).not.toBe(token);
    expect(deriveManagementToken(secret, 'org-a', 'appointment-a', 2)).not.toBe(token);
  });

  it('stores and compares only the digest', () => {
    const token = deriveManagementToken(secret, 'org', 'appointment', 4);
    const digest = hashManagementToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(token);
    expect(matchesManagementToken(token, digest)).toBe(true);
    expect(matchesManagementToken(`${token}x`, digest)).toBe(false);
  });
});
