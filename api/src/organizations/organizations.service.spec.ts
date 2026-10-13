import { describe, expect, it, vi } from 'vitest';
import { OrganizationsService, onboardingRequestHash } from './organizations.service.js';
import type { CreateOrganizationDto } from './organizations.dto.js';

const now = new Date('2026-10-12T12:00:00.000Z');
const org = { id: 'org-id', name: 'Mi negocio', slug: 'mi-negocio', businessType: 'SERVICES' as const, createdAt: now, updatedAt: now };
const member = { id: 'member-id', userId: 'user-id', organizationId: org.id, role: 'OWNER' as const, status: 'ACTIVE' as const, createdAt: now, updatedAt: now, organization: org };
const input: CreateOrganizationDto = { name: org.name, slug: org.slug, businessType: 'SERVICES', planCode: 'BASIC' };
const principal = { userId: 'user-id', sessionId: 'session-id', activeOrganizationId: null };

function setup(overrides: { existing?: object | null; members?: object[]; grant?: boolean; verified?: boolean } = {}) {
  const user = { id: 'user-id', name: 'A User', email: 'a@example.test', emailVerifiedAt: overrides.verified === false ? null : now, createdAt: now, updatedAt: now };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: user.id }]),
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    session: { findUnique: vi.fn().mockResolvedValue({ id: 'session-id', userId: user.id, activeOrganizationId: null, revokedAt: null, credentialVersion: 1, expiresAt: new Date(now.getTime() + 60_000), lastSeenAt: now, user: { credential: { version: 1 } } }), update: vi.fn().mockResolvedValue({}) },
    organizationMember: { findMany: vi.fn().mockResolvedValue(overrides.members ?? []), findFirst: vi.fn().mockResolvedValue(member), create: vi.fn().mockResolvedValue(member) },
    onboardingSubmission: { findUnique: vi.fn().mockResolvedValue(overrides.existing ?? null), create: vi.fn().mockResolvedValue({}) },
    organization: { create: vi.fn().mockResolvedValue(org) },
  };
  const db = { $transaction: vi.fn((callback: (context: typeof tx) => unknown) => callback(tx)) };
  const identity = { lockUser: vi.fn().mockResolvedValue(user), assertSession: vi.fn().mockResolvedValue(undefined), selectOrganization: vi.fn().mockResolvedValue(undefined) };
  const subscriptions = { hasTrialGrant: vi.fn().mockResolvedValue(overrides.grant ?? false), createTrial: vi.fn().mockResolvedValue(undefined), state: vi.fn().mockResolvedValue({ subscription: { id: 'sub-id' }, access: { businessAllowed: true } }) };
  const clock = { now: vi.fn().mockReturnValue(now) };
  return { service: new OrganizationsService(db as never, identity as never, subscriptions as never, clock as never), tx, db, identity, subscriptions, clock };
}

describe('OrganizationsService initial onboarding', () => {
  it('hashes the canonical validated request and atomically creates OWNER, trial, result, and session selection', async () => {
    const { service, tx, db, identity, subscriptions } = setup();
    const result = await service.createInitial(principal, 'key', input);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(identity.lockUser).toHaveBeenCalledWith(tx, 'user-id');
    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: input.name, slug: input.slug, businessType: input.businessType, createdAt: now, updatedAt: now } });
    expect(tx.organizationMember.create).toHaveBeenCalledWith({ data: { userId: 'user-id', organizationId: org.id, role: 'OWNER', status: 'ACTIVE', createdAt: now, updatedAt: now } });
    expect(subscriptions.createTrial).toHaveBeenCalledWith(tx, 'user-id', org.id, 'BASIC', now);
    expect(tx.onboardingSubmission.create).toHaveBeenCalledWith({ data: { userId: 'user-id', key: 'key', requestHash: onboardingRequestHash(input), organizationId: org.id, createdAt: now } });
    expect(identity.selectOrganization).toHaveBeenCalledWith(tx, principal, org.id);
    expect(result).toMatchObject({ replay: false, organization: { id: org.id }, membership: { role: 'OWNER' } });
  });

  it('resolves a selected active membership, falls back deterministically, and returns the full access snapshot', async () => {
    const secondOrganization = { ...org, id: 'org-second', slug: 'segundo-negocio' };
    const secondMember = { ...member, id: 'member-second', organizationId: secondOrganization.id, role: 'ADMIN' as const, organization: secondOrganization };
    const { service, tx, identity } = setup({ members: [member, secondMember] });
    const snapshot = await service.snapshot({ ...principal, activeOrganizationId: secondOrganization.id });
    expect(snapshot).toMatchObject({
      memberships: [{ role: 'OWNER', organization: { id: org.id } }, { role: 'ADMIN', organization: { id: secondOrganization.id } }],
      activeOrganizationId: secondOrganization.id,
      access: { businessAllowed: true },
      onboarding: { canCreateOrganization: false, reason: 'HAS_MEMBERSHIP' },
    });
    expect(identity.selectOrganization).toHaveBeenCalledWith(tx, { ...principal, activeOrganizationId: secondOrganization.id }, secondOrganization.id);
  });

  it('returns onboarding eligibility reasons without inventing a membership', async () => {
    const unverified = setup({ verified: false });
    await expect(unverified.service.snapshot(principal)).resolves.toMatchObject({ memberships: [], activeOrganizationId: null, access: null, onboarding: { canCreateOrganization: false, reason: 'EMAIL_UNVERIFIED' } });
    const usedTrial = setup({ grant: true });
    await expect(usedTrial.service.snapshot(principal)).resolves.toMatchObject({ onboarding: { canCreateOrganization: false, reason: 'TRIAL_ALREADY_USED' } });
    const eligible = setup();
    await expect(eligible.service.snapshot(principal)).resolves.toMatchObject({ onboarding: { canCreateOrganization: true, reason: 'ELIGIBLE' } });
  });

  it('replays a matching idempotency key without creating another organization', async () => {
    const { service, tx } = setup({ existing: { userId: 'user-id', key: 'key', requestHash: onboardingRequestHash(input), organizationId: org.id } });
    const result = await service.createInitial(principal, 'key', input);
    expect(result.replay).toBe(true);
    expect(tx.organization.create).not.toHaveBeenCalled();
    expect(tx.onboardingSubmission.create).not.toHaveBeenCalled();
  });

  it('rejects changed payload on replay, existing membership, used trial, and unverified email', async () => {
    const mismatch = setup({ existing: { requestHash: 'different', organizationId: org.id } });
    await expect(mismatch.service.createInitial(principal, 'key', input)).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_CONFLICT' } });

    const hasMembership = setup({ members: [member] });
    await expect(hasMembership.service.createInitial(principal, 'key', input)).rejects.toMatchObject({ status: 409, response: { code: 'ONBOARDING_ALREADY_COMPLETED' } });

    const usedTrial = setup({ grant: true });
    await expect(usedTrial.service.createInitial(principal, 'key', input)).rejects.toMatchObject({ status: 403, response: { code: 'TRIAL_ALREADY_USED' } });

    const unverified = setup({ verified: false });
    await expect(unverified.service.createInitial(principal, 'key', input)).rejects.toMatchObject({ status: 403, response: { code: 'EMAIL_UNVERIFIED' } });
  });
});
