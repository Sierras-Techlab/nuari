import { describe, expect, it } from 'vitest';
import type { Subscription } from '../generated/prisma/client.js';
import { canManageSubscription, effectiveStatus, evaluateAccess, hasBusinessPermission } from './subscription.policy.js';

const start = new Date('2026-10-01T12:00:00.000Z');
const end = new Date(start.getTime() + 336 * 60 * 60 * 1000);
const trial = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1', organizationId: 'org-1', planCode: 'BASIC', status: 'TRIALING',
  trialStartedAt: start, trialEndsAt: end, paidThrough: null, createdAt: start, updatedAt: start,
  ...overrides,
});

describe('subscription policy', () => {
  it('allows trial only from its start, exclusively until its exact end', () => {
    expect(evaluateAccess(trial(), 'OWNER', start).businessAllowed).toBe(true);
    expect(evaluateAccess(trial(), 'EMPLOYEE', new Date(end.getTime() - 1)).businessAllowed).toBe(true);
    expect(evaluateAccess(trial(), 'OWNER', new Date(start.getTime() - 1))).toMatchObject({ businessAllowed: false, reason: 'SUBSCRIPTION_INACTIVE' });
    expect(evaluateAccess(trial(), 'OWNER', end)).toMatchObject({ businessAllowed: false, reason: 'TRIAL_EXPIRED' });
    expect(effectiveStatus(trial(), end)).toBe('EXPIRED');
  });

  it('keeps subscription status available while expired and denies missing/inactive subscriptions', () => {
    expect(evaluateAccess(trial({ status: 'EXPIRED' }), 'ADMIN', start).businessAllowed).toBe(false);
    expect(evaluateAccess(null, 'EMPLOYEE', start)).toMatchObject({ businessAllowed: false, reason: 'SUBSCRIPTION_INACTIVE', canManageSubscription: false });
    expect(evaluateAccess(trial({ status: 'CANCELED' }), 'OWNER', start).reason).toBe('SUBSCRIPTION_INACTIVE');
  });

  it('evaluates paid-through access and maps every role capability', () => {
    const paid = trial({ status: 'ACTIVE', paidThrough: end });
    expect(evaluateAccess(paid, 'ADMIN', new Date(end.getTime() - 1))).toMatchObject({ businessAllowed: true, reason: 'PAID_ACTIVE', canManageSubscription: true });
    expect(evaluateAccess(paid, 'EMPLOYEE', end)).toMatchObject({ businessAllowed: false, canManageSubscription: false });
    expect(effectiveStatus(paid, end)).toBe('PAST_DUE');
    for (const role of ['OWNER', 'ADMIN', 'EMPLOYEE'] as const) expect(hasBusinessPermission(role)).toBe(true);
    expect(canManageSubscription('OWNER')).toBe(true);
    expect(canManageSubscription('ADMIN')).toBe(true);
    expect(canManageSubscription('EMPLOYEE')).toBe(false);
  });
});
