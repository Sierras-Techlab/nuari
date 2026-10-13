import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApiHarness, type ApiHarness } from './harness.js';
import { TRIAL_MS } from '../src/subscriptions/subscription.policy.js';
import type { CreateOrganizationDto } from '../src/organizations/organizations.dto.js';
import { Prisma } from '../src/generated/prisma/client.js';

describe('tenant, trial and idempotency PostgreSQL guarantees', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness(); });
  afterAll(async () => { await h?.close(); });
  const input = (): CreateOrganizationDto => ({ name: 'Owned Test Business', slug: `test-${randomUUID()}`, businessType: 'COMMERCE', planCode: 'TOURISM' });

  it('makes at most three total attempts only for Prisma transaction conflicts', async () => {
    const user = await h.user();
    const conflict = new Prisma.PrismaClientKnownRequestError('test transaction conflict', { code: 'P2034', clientVersion: '7.10.0' });
    const spy = vi.spyOn(h.db, '$transaction').mockRejectedValue(conflict);
    try {
      await expect(h.organizations.createInitial(user.principal, randomUUID(), input())).rejects.toBe(conflict);
      expect(spy).toHaveBeenCalledTimes(3);
    } finally { spy.mockRestore(); }
    const failure = new Error('non-transient test failure');
    const unexpected = vi.spyOn(h.db, '$transaction').mockRejectedValue(failure);
    try {
      await expect(h.organizations.createInitial(user.principal, randomUUID(), input())).rejects.toBe(failure);
      expect(unexpected).toHaveBeenCalledTimes(1);
    } finally { unexpected.mockRestore(); }
  });
  it('does not classify a non-slug unique invariant as SLUG_TAKEN', async () => {
    const user = await h.user();
    const invariant = new Prisma.PrismaClientKnownRequestError('test unique invariant', { code: 'P2002', clientVersion: '7.10.0', meta: { modelName: 'Subscription', target: ['organizationId'] } });
    const spy = vi.spyOn(h.db, '$transaction').mockRejectedValue(invariant);
    try { await expect(h.organizations.createInitial(user.principal, randomUUID(), input())).rejects.toBe(invariant); }
    finally { spy.mockRestore(); }
  });

  it('creates exactly one atomic trial result under concurrent same-key submissions', async () => {
    const user = await h.user();
    const key = randomUUID();
    const request = input();
    const results = await Promise.all(Array.from({ length: 6 }, () => h.organizations.createInitial(user.principal, key, request)));
    expect(results.filter(result => !result.replay)).toHaveLength(1);
    expect(new Set(results.map(result => result.organization.id)).size).toBe(1);
    expect(new Set(results.map(result => result.subscription!.trialEndsAt)).size).toBe(1);
    const result = results[0];
    expect(result.membership).toMatchObject({ role: 'OWNER', status: 'ACTIVE' });
    expect(result.organization.businessType).toBe('COMMERCE');
    expect(result.subscription!.planCode).toBe('TOURISM');
    const start = new Date(result.subscription!.trialStartedAt);
    expect(new Date(result.subscription!.trialEndsAt).getTime() - start.getTime()).toBe(TRIAL_MS);
    expect((await h.db.trialGrant.findUniqueOrThrow({ where: { userId: user.id } })).grantedAt).toEqual(start);
    expect(await h.db.onboardingSubmission.count({ where: { userId: user.id } })).toBe(1);
    expect((await h.db.session.findUniqueOrThrow({ where: { id: user.principal.sessionId } })).activeOrganizationId).toBe(result.organization.id);
    await expect(h.organizations.createInitial(user.principal, key, { ...request, planCode: 'PRO' })).rejects.toMatchObject({ status: 409 });
  });

  it('different keys for one account permit only one new creation', async () => {
    const user = await h.user();
    const results = await Promise.allSettled([h.organizations.createInitial(user.principal, randomUUID(), input()), h.organizations.createInitial(user.principal, randomUUID(), input())]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await h.db.trialGrant.count({ where: { userId: user.id } })).toBe(1);
  });

  it('slug collision across users rolls back the losing grant/key and can be retried', async () => {
    const [first, second] = await Promise.all([h.user(), h.user()]);
    const request = input();
    const key1 = randomUUID(), key2 = randomUUID();
    const results = await Promise.allSettled([h.organizations.createInitial(first.principal, key1, request), h.organizations.createInitial(second.principal, key2, request)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const losing = results[0].status === 'rejected' ? first : second;
    const losingKey = results[0].status === 'rejected' ? key1 : key2;
    expect(await h.db.trialGrant.count({ where: { userId: losing.id } })).toBe(0);
    expect(await h.db.onboardingSubmission.count({ where: { userId: losing.id } })).toBe(0);
    await h.organizations.createInitial(losing.principal, losingKey, input());
  });

  it('replay recalculates expiry, denies lost membership, and a permanent grant prevents another trial', async () => {
    const user = await h.user();
    const request = input(), key = randomUUID();
    const original = await h.organizations.createInitial(user.principal, key, request);
    const end = new Date(original.subscription!.trialEndsAt);
    // Keep the session active across 14 days; tests do not wait in real time.
    h.clock.set(end);
    await h.db.session.update({ where: { id: user.principal.sessionId }, data: { lastSeenAt: end } });
    const replay = await h.organizations.createInitial(user.principal, key, request);
    expect(replay.subscription).toMatchObject({ status: 'EXPIRED', trialEndsAt: original.subscription!.trialEndsAt });
    await h.db.organizationMember.update({ where: { id: original.membership.id }, data: { status: 'INACTIVE' } });
    await expect(h.organizations.createInitial(user.principal, key, request)).rejects.toMatchObject({ status: 404 });
    await expect(h.organizations.createInitial(user.principal, randomUUID(), input())).rejects.toMatchObject({ status: 403 });
    expect((await h.organizations.snapshot(user.principal)).onboarding.reason).toBe('TRIAL_ALREADY_USED');
  });

  it('an unverified account cannot create; active employees do not need personal onboarding', async () => {
    const owner = await h.user();
    const employee = await h.user({ verified: false });
    await expect(h.organizations.createInitial(employee.principal, randomUUID(), input())).rejects.toMatchObject({ status: 403 });
    const organization = await h.organizations.createInitial(owner.principal, randomUUID(), input());
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: organization.organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });
    const snapshot = await h.organizations.snapshot(employee.principal);
    expect(snapshot.activeOrganizationId).toBe(organization.organization.id);
    expect(snapshot.onboarding.reason).toBe('HAS_MEMBERSHIP');
    expect(snapshot.access?.businessAllowed).toBe(true);
    expect(snapshot.access?.canManageSubscription).toBe(false);
    expect(await h.subscriptions.hasTrialGrant(employee.id)).toBe(false);
  });

  it('resolves several roles and stable fallback, hiding unknown/foreign/inactive tenants', async () => {
    const [a, b, subject] = await Promise.all([h.user(), h.user(), h.user()]);
    const first = await h.organizations.createInitial(a.principal, randomUUID(), input());
    const second = await h.organizations.createInitial(b.principal, randomUUID(), input());
    const admin = await h.db.organizationMember.create({ data: { userId: subject.id, organizationId: first.organization.id, role: 'ADMIN', status: 'ACTIVE', createdAt: new Date(h.clock.now().getTime() - 1000) } });
    await h.db.organizationMember.create({ data: { userId: subject.id, organizationId: second.organization.id, role: 'EMPLOYEE', status: 'ACTIVE', createdAt: h.clock.now() } });
    expect((await h.organizations.snapshot(subject.principal)).activeOrganizationId).toBe(first.organization.id);
    const selected = await h.organizations.snapshot(subject.principal, second.organization.id);
    expect(selected.access?.canManageSubscription).toBe(false);
    await expect(h.organizations.snapshot(a.principal, second.organization.id)).rejects.toMatchObject({ status: 404 });
    await h.db.organizationMember.update({ where: { id: admin.id }, data: { status: 'INACTIVE' } });
    expect((await h.organizations.snapshot(subject.principal)).activeOrganizationId).toBe(second.organization.id);
    await expect(h.organizations.resolveMember(subject.id, first.organization.id)).rejects.toMatchObject({ status: 404 });
    await expect(h.organizations.resolveMember(subject.id, randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it('CHECKs and restrictive FKs reject invalid persistent states', async () => {
    const user = await h.user();
    const organization = await h.organizations.createInitial(user.principal, randomUUID(), input());
    await expect(h.db.$executeRaw`UPDATE "User" SET "email" = 'UPPER@EXAMPLE.TEST' WHERE "id" = ${user.id}::uuid`).rejects.toThrow();
    await expect(h.db.$executeRaw`UPDATE "UserCredential" SET "version" = 0 WHERE "userId" = ${user.id}::uuid`).rejects.toThrow();
    await expect(h.db.$executeRaw`UPDATE "Session" SET "credentialVersion" = 0 WHERE "id" = ${user.principal.sessionId}::uuid`).rejects.toThrow();
    await expect(h.db.$executeRaw`UPDATE "Organization" SET "slug" = 'two--dashes' WHERE "id" = ${organization.organization.id}::uuid`).rejects.toThrow();
    await expect(h.db.$executeRaw`UPDATE "Subscription" SET "trialEndsAt" = "trialEndsAt" + interval '1 second' WHERE "organizationId" = ${organization.organization.id}::uuid`).rejects.toThrow();
    await expect(h.db.$executeRaw`UPDATE "Subscription" SET "status" = 'ACTIVE' WHERE "organizationId" = ${organization.organization.id}::uuid`).rejects.toThrow();
    await expect(h.db.user.delete({ where: { id: user.id } })).rejects.toThrow();
    await expect(h.db.organization.delete({ where: { id: organization.organization.id } })).rejects.toThrow();
    await expect(h.db.trialGrant.create({ data: { userId: user.id, organizationId: organization.organization.id, grantedAt: h.clock.now() } })).rejects.toThrow();
  });

  it.each(['Organization', 'OrganizationMember', 'Subscription', 'TrialGrant', 'OnboardingSubmission', 'Session', 'Commit'] as const)('rolls back every row when %s fails', async stage => {
    const user = await h.user();
    const request = input();
    const suffix = randomUUID().replaceAll('-', '');
    const functionName = `fail_${suffix}`;
    const triggerName = `trigger_${suffix}`;
    const table = stage === 'Commit' ? 'OnboardingSubmission' : stage;
    const condition = table === 'Organization' ? `NEW."slug" = '${request.slug}'` : table === 'Subscription' ? `EXISTS (SELECT 1 FROM "Organization" WHERE "id" = NEW."organizationId" AND "slug" = '${request.slug}')` : `NEW."userId" = '${user.id}'::uuid`;
    // Identifiers/data here are exclusively generated test UUIDs and a closed table list.
    await h.db.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'injected isolated test failure'; END IF; RETURN NEW; END $$`);
    try {
      await h.db.$executeRawUnsafe(stage === 'Commit'
        ? `CREATE CONSTRAINT TRIGGER "${triggerName}" AFTER INSERT ON "${table}" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`
        : `CREATE TRIGGER "${triggerName}" BEFORE ${stage === 'Session' ? 'UPDATE' : 'INSERT'} ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      await expect(h.organizations.createInitial(user.principal, randomUUID(), request)).rejects.toThrow();
      expect(await h.db.organization.count({ where: { slug: request.slug } })).toBe(0);
      expect(await h.db.organizationMember.count({ where: { userId: user.id } })).toBe(0);
      expect(await h.db.trialGrant.count({ where: { userId: user.id } })).toBe(0);
      expect(await h.db.onboardingSubmission.count({ where: { userId: user.id } })).toBe(0);
      expect((await h.db.session.findUniqueOrThrow({ where: { id: user.principal.sessionId } })).activeOrganizationId).toBeNull();
    } finally {
      await h.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "${table}"`);
      await h.db.$executeRawUnsafe(`DROP FUNCTION "${functionName}"()`);
    }
    // A failed key/slug/grant has not been consumed.
    await h.organizations.createInitial(user.principal, randomUUID(), request);
  });
});
