import { describe, expect, it } from 'vitest';
import { bookingSubmissionDigests } from './booking-submissions.js';

describe('booking submission digests', () => {
  const request = {
    customerId: 'customer-id', serviceId: 'service-id', startAt: '2027-05-14T19:00:00.000Z',
    assignment: { kind: 'SPECIFIC' as const, staffMemberId: 'staff-id' }, internalNotes: null,
  };

  it('stores a one-way digest of the idempotency key and signs the canonical request', () => {
    const first = bookingSubmissionDigests('a-random-key', 's'.repeat(32), request);
    expect(first.keyHash).not.toContain('a-random-key');
    expect(first.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.requestHashKeyVersion).toBe(1);
    expect(bookingSubmissionDigests('a-random-key', 's'.repeat(32), request)).toEqual(first);
    expect(bookingSubmissionDigests('a-random-key', 's'.repeat(32), request, 2).requestHashKeyVersion).toBe(2);
    expect(bookingSubmissionDigests('a-random-key', 's'.repeat(32), { ...request, startAt: '2027-05-14T19:15:00.000Z' }).requestHash).not.toBe(first.requestHash);
    expect(bookingSubmissionDigests('another-key', 's'.repeat(32), request).keyHash).not.toBe(first.keyHash);
  });
});
