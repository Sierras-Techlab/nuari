import { createHash, createHmac } from 'node:crypto';

export interface CanonicalBookingRequest {
  customerId?: string;
  customer?: { name: string; phone: string | null; email: string | null };
  serviceId: string;
  startAt: string;
  assignment: { kind: 'SPECIFIC' | 'ANY' | 'NONE'; staffMemberId?: string };
  internalNotes: string | null;
}

export function bookingSubmissionDigests(idempotencyKey: string, secret: string, request: CanonicalBookingRequest, requestHashKeyVersion = 1) {
  const canonical = JSON.stringify({
    customerId: request.customerId ?? null,
    ...(request.customer ? { customer: request.customer } : {}),
    serviceId: request.serviceId,
    startAt: request.startAt,
    assignment: { kind: request.assignment.kind, staffMemberId: request.assignment.staffMemberId ?? null },
    internalNotes: request.internalNotes,
  });
  return {
    keyHash: createHash('sha256').update(idempotencyKey).digest('hex'),
    requestHash: createHmac('sha256', secret).update(canonical).digest('hex'),
    requestHashKeyVersion,
  };
}
