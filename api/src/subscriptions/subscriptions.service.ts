import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { TransactionContext } from '../common/transaction.js';
import type { OrganizationRole, PlanCode } from '../generated/prisma/client.js';
import { TRIAL_MS, evaluateAccess, subscriptionDto } from './subscription.policy.js';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly db: PrismaService) {}
  async hasTrialGrant(userId: string, tx: TransactionContext = this.db): Promise<boolean> {
    return !!await tx.trialGrant.findUnique({ where: { userId }, select: { id: true } });
  }
  async createTrial(tx: TransactionContext, userId: string, organizationId: string, planCode: PlanCode, now: Date): Promise<void> {
    await tx.subscription.create({ data: { organizationId, planCode, status: 'TRIALING', trialStartedAt: now, trialEndsAt: new Date(now.getTime() + TRIAL_MS), createdAt: now, updatedAt: now } });
    await tx.trialGrant.create({ data: { userId, organizationId, grantedAt: now } });
  }
  async state(organizationId: string, role: OrganizationRole, now: Date, tx: TransactionContext = this.db) {
    const subscription = await tx.subscription.findUnique({ where: { organizationId } });
    return { subscription: subscription ? subscriptionDto(subscription, now) : null, access: evaluateAccess(subscription, role, now) };
  }
}
