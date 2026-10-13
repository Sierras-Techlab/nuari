import type { OrganizationRole, Subscription } from '../generated/prisma/client.js';

export const TRIAL_MS = 336 * 60 * 60 * 1000;
export type Access = {
  businessAllowed: boolean;
  reason: 'TRIAL_ACTIVE' | 'PAID_ACTIVE' | 'TRIAL_EXPIRED' | 'SUBSCRIPTION_INACTIVE';
  validUntil: string | null;
  canManageSubscription: boolean;
};
export const canManageSubscription = (role: OrganizationRole): boolean => role === 'OWNER' || role === 'ADMIN';
export const hasBusinessPermission = (role: OrganizationRole): boolean => ['OWNER', 'ADMIN', 'EMPLOYEE'].includes(role);

export function effectiveStatus(subscription: Subscription, now: Date): Subscription['status'] {
  if (subscription.status === 'TRIALING' && now >= subscription.trialEndsAt) return 'EXPIRED';
  if (subscription.status === 'ACTIVE' && (!subscription.paidThrough || now >= subscription.paidThrough)) return 'PAST_DUE';
  return subscription.status;
}
export function evaluateAccess(subscription: Subscription | null, role: OrganizationRole, now: Date): Access {
  const base = { canManageSubscription: canManageSubscription(role) };
  if (!subscription) return { ...base, businessAllowed: false, reason: 'SUBSCRIPTION_INACTIVE', validUntil: null };
  if (subscription.status === 'TRIALING' || subscription.status === 'EXPIRED') {
    const allowed = subscription.status === 'TRIALING' && subscription.trialStartedAt <= now && now < subscription.trialEndsAt;
    return { ...base, businessAllowed: allowed, reason: allowed ? 'TRIAL_ACTIVE' : now >= subscription.trialEndsAt ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_INACTIVE', validUntil: subscription.trialEndsAt.toISOString() };
  }
  if (subscription.status === 'ACTIVE' && subscription.paidThrough && subscription.paidThrough > now) return { ...base, businessAllowed: true, reason: 'PAID_ACTIVE', validUntil: subscription.paidThrough.toISOString() };
  return { ...base, businessAllowed: false, reason: 'SUBSCRIPTION_INACTIVE', validUntil: subscription.paidThrough?.toISOString() ?? null };
}
export const subscriptionDto = (subscription: Subscription, now: Date) => ({
  id: subscription.id, organizationId: subscription.organizationId, planCode: subscription.planCode,
  status: effectiveStatus(subscription, now), trialStartedAt: subscription.trialStartedAt.toISOString(),
  trialEndsAt: subscription.trialEndsAt.toISOString(), paidThrough: subscription.paidThrough?.toISOString() ?? null,
});
