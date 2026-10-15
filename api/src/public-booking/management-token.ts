import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function deriveManagementToken(secret: string, organizationId: string, appointmentId: string, version: number): string {
  return createHmac('sha256', secret).update(`${organizationId}:${appointmentId}:${version}`).digest('base64url');
}

export function hashManagementToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function matchesManagementToken(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashManagementToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
