import { describe, expect, it, vi } from 'vitest';
import { OrganizationsService, onboardingRequestHash } from './organizations.service.js';
import type { CreateOrganizationDto } from './organizations.dto.js';

const now = new Date('2026-10-12T12:00:00.000Z');
const org = {
  id: 'org-id',
  name: 'Mi negocio',
  slug: 'mi-negocio',
  businessType: 'SERVICES' as const,
  description: null,
  email: null,
  phone: null,
  website: null,
  country: 'AR',
  state: null,
  city: null,
  zip: null,
  address: null,
  timezone: 'America/Argentina/Buenos_Aires',
  currency: 'ARS',
  logoUrl: null,
  createdAt: now,
  updatedAt: now,
};
const member = { id: 'member-id', userId: 'user-id', organizationId: org.id, role: 'OWNER' as const, status: 'ACTIVE' as const, createdAt: now, updatedAt: now, organization: org };
const input: CreateOrganizationDto = { name: org.name, slug: org.slug, businessType: 'SERVICES', planCode: 'BASIC' };
const principal = { userId: 'user-id', sessionId: 'session-id', activeOrganizationId: null };

function setup(overrides: { existing?: object | null; members?: object[]; grant?: boolean; verified?: boolean; inactiveMembership?: object | null } = {}) {
  const user = { id: 'user-id', name: 'A User', email: 'a@example.test', emailVerifiedAt: overrides.verified === false ? null : now, createdAt: now, updatedAt: now };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: user.id }]),
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    session: { findUnique: vi.fn().mockResolvedValue({ id: 'session-id', userId: user.id, activeOrganizationId: null, revokedAt: null, credentialVersion: 1, expiresAt: new Date(now.getTime() + 60_000), lastSeenAt: now, user: { credential: { version: 1 } } }), update: vi.fn().mockResolvedValue({}) },
    organizationMember: {
      findMany: vi.fn().mockResolvedValue(overrides.members ?? []),
      findFirst: vi.fn().mockImplementation(({ where }: { where?: { status?: string } } = {}) => Promise.resolve(where?.status === 'INACTIVE' ? overrides.inactiveMembership ?? null : member)),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(member),
      update: vi.fn().mockResolvedValue(member),
      count: vi.fn().mockResolvedValue(1),
    },
    organizationInvitation: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    onboardingSubmission: { findUnique: vi.fn().mockResolvedValue(overrides.existing ?? null), create: vi.fn().mockResolvedValue({}) },
    organization: { create: vi.fn().mockResolvedValue(org), findUnique: vi.fn().mockResolvedValue(org), update: vi.fn().mockResolvedValue(org) },
    service: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    organizationAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = {
    $transaction: vi.fn((callback: (context: typeof tx) => unknown) => callback(tx)),
    organizationMember: tx.organizationMember,
    organizationInvitation: tx.organizationInvitation,
  };


  const identity = { lockUser: vi.fn().mockResolvedValue(user), assertSession: vi.fn().mockResolvedValue(undefined), selectOrganization: vi.fn().mockResolvedValue(undefined) };
  const subscriptions = { hasTrialGrant: vi.fn().mockResolvedValue(overrides.grant ?? false), createTrial: vi.fn().mockResolvedValue(undefined), state: vi.fn().mockResolvedValue({ subscription: { id: 'sub-id' }, access: { businessAllowed: true } }) };
  const clock = { now: vi.fn().mockReturnValue(now) };
  const emails = { enqueue: vi.fn() };

  return { service: new OrganizationsService(db as never, identity as never, subscriptions as never, clock as never, emails as never), tx, db, identity, subscriptions, clock, emails };
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

  it('reports revoked access when no active memberships remain and preserves create eligibility separately', async () => {
    const inactive = { ...member, status: 'INACTIVE' as const };
    const { service, identity } = setup({ inactiveMembership: inactive });
    const snapshot = await service.snapshot(principal);
    expect(snapshot).toMatchObject({ memberships: [], activeOrganizationId: null, access: null, onboarding: { reason: 'ACCESS_REVOKED', canCreateOrganization: true } });
    expect(identity.selectOrganization).toHaveBeenCalledWith(expect.anything(), principal, null);
  });

  it('selects another active organization when the session organization has been revoked', async () => {
    const otherOrganization = { ...org, id: 'org-other', slug: 'otro-negocio' };
    const otherMember = { ...member, id: 'member-other', organizationId: otherOrganization.id, role: 'EMPLOYEE' as const, organization: otherOrganization };
    const { service, tx, identity } = setup({ members: [otherMember] });
    const snapshot = await service.snapshot({ ...principal, activeOrganizationId: org.id });
    expect(snapshot).toMatchObject({ memberships: [{ organization: { id: otherOrganization.id } }], activeOrganizationId: otherOrganization.id });
    expect(identity.selectOrganization).toHaveBeenCalledWith(tx, { ...principal, activeOrganizationId: org.id }, otherOrganization.id);
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

describe('OrganizationsService operational audit', () => {
  it('records changed field names in the supplied transaction without storing values', async () => {
    const { service, tx } = setup();
    await service.recordOperationalAudit(tx as never, {
      organizationId: org.id,
      actorUserId: 'user-id',
      action: 'CUSTOMER_UPDATED',
      targetId: 'customer-id',
      changedFields: ['name', 'phone'],
    });

    expect(tx.organizationAuditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: org.id,
        actorUserId: 'user-id',
        action: 'CUSTOMER_UPDATED',
        targetId: 'customer-id',
        metadata: JSON.stringify({ changedFields: ['name', 'phone'] }),
        createdAt: now,
      },
    });
  });

  it('rejects field values that are not approved audit field names', async () => {
    const { service, tx } = setup();
    await expect(service.recordOperationalAudit(tx as never, {
      organizationId: org.id,
      actorUserId: 'user-id',
      action: 'CUSTOMER_UPDATED',
      targetId: 'customer-id',
      changedFields: ['phone:+5491122334455'] as never,
    })).rejects.toThrow('Invalid operational audit field.');
    expect(tx.organizationAuditLog.create).not.toHaveBeenCalled();
  });
});

describe('OrganizationsService updateSettings', () => {
  it('requires explicit confirmation for an effective currency change', async () => {
    const { service, tx } = setup();
    await expect(service.updateSettings(member, 'user-id', { country: 'UY' })).rejects.toMatchObject({
      status: 400, response: { code: 'VALIDATION_ERROR', fieldErrors: { confirmCurrencyChange: expect.any(Array) } },
    });
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it('blocks currency changes when any service has a persisted amount, even zero/inactive', async () => {
    const { service, tx } = setup();
    tx.service.findFirst = vi.fn().mockResolvedValue({ id: 'priced-service' });
    await expect(service.updateSettings(member, 'user-id', { country: 'UY', confirmCurrencyChange: true })).rejects.toMatchObject({
      status: 409, response: { code: 'CURRENCY_CHANGE_REQUIRES_MIGRATION' },
    });
    expect(tx.organization.update).not.toHaveBeenCalled();
    expect(tx.service.updateMany).not.toHaveBeenCalled();
  });

  it('updates descriptive currency atomically for services with no price after confirmation', async () => {
    const { service, tx } = setup();
    await service.updateSettings(member, 'user-id', { country: 'UY', confirmCurrencyChange: true });
    expect(tx.organization.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: org.id }, data: expect.objectContaining({ country: 'UY', currency: 'UYU' }),
    }));
    expect(tx.service.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: org.id, price: null },
      data: expect.objectContaining({ currency: 'UYU', version: { increment: 1 }, updatedAt: now }),
    }));
  });

  it('allows OWNER to update commercial settings, slug, and records audit log', async () => {
    const { service, tx } = setup();
    tx.organization.update = vi.fn().mockResolvedValue({
      ...org,
      name: 'Nuevo Nombre',
      slug: 'nuevo-slug',
      country: 'AR',
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      phone: '+5491122334455',
    });
    tx.organizationAuditLog = { create: vi.fn().mockResolvedValue({}) };

    const result = await service.updateSettings(
      member,
      'user-id',
      { name: 'Nuevo Nombre', slug: 'nuevo-slug', country: 'AR', phone: '+5491122334455' },
    );

    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: org.id },
      data: expect.objectContaining({
        name: 'Nuevo Nombre',
        slug: 'nuevo-slug',
        country: 'AR',
        phone: '+5491122334455',
      }),
    });
    expect(tx.organizationAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: org.id,
        actorUserId: 'user-id',
        action: 'ORGANIZATION_SETTINGS_UPDATED',
        targetId: org.id,
      }),
    });
    expect(result.name).toBe('Nuevo Nombre');
    expect(result.slug).toBe('nuevo-slug');
  });

  it('allows ADMIN to update commercial fields but rejects changing slug', async () => {
    const { service } = setup();
    const adminMember = { ...member, role: 'ADMIN' as const };

    await expect(
      service.updateSettings(adminMember, 'user-id', { slug: 'slug-cambiado' }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it('rejects EMPLOYEE from updating any organization settings', async () => {
    const { service } = setup();
    const employeeMember = { ...member, role: 'EMPLOYEE' as const };

    await expect(
      service.updateSettings(employeeMember, 'user-id', { name: 'Intento Empleado' }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it('validates country, currency correspondence, and timezone', async () => {
    const { service } = setup();

    // Invalid country
    await expect(
      service.updateSettings(member, 'user-id', { country: 'US' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'VALIDATION_ERROR' },
    });

    // Mismatched currency for Chile (CLP expected, ARS passed)
    await expect(
      service.updateSettings(member, 'user-id', { country: 'CL', currency: 'ARS' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'VALIDATION_ERROR' },
    });

    // Invalid timezone for Uruguay
    await expect(
      service.updateSettings(member, 'user-id', { country: 'UY', currency: 'UYU', timezone: 'America/Argentina/Buenos_Aires' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'VALIDATION_ERROR' },
    });
  });

  it('maps empty strings to null when clearing optional fields, and allows null/empty/existing logoUrl', async () => {
    const { service, tx } = setup();

    await service.updateSettings(member, 'user-id', {
      email: '',
      phone: '',
      website: '',
      description: '',
      state: '',
      city: '',
      zip: '',
      address: '',
      logoUrl: '',
    });

    expect(tx.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: null,
          phone: null,
          website: null,
          description: null,
          state: null,
          city: null,
          zip: null,
          address: null,
          logoUrl: null,
        }),
      }),
    );
  });
});

describe('OrganizationsService member and invitation management', () => {
  it('lists active members only', async () => {
    const { service, db } = setup();
    db.organizationMember.findMany = vi.fn().mockResolvedValue([]);
    await service.listMembers(org.id);
    expect(db.organizationMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: org.id, status: 'ACTIVE' } }));
  });

  it('persists revocation as INACTIVE and retains the member record', async () => {
    const { service, tx } = setup();
    const target = { ...member, id: 'employee-id', role: 'EMPLOYEE' as const, user: { id: 'employee-user', name: 'Empleado', email: 'employee@example.test' } };
    const inactive = { ...target, status: 'INACTIVE' as const };
    tx.organizationMember.findFirst = vi.fn().mockResolvedValue(target);
    tx.organizationMember.update = vi.fn().mockResolvedValue(inactive);
    await expect(service.removeMember(member, 'owner-user', target.id)).resolves.toMatchObject({ id: target.id, status: 'INACTIVE' });
    expect(tx.organizationMember.update).toHaveBeenCalledWith({ where: { id: target.id }, data: { status: 'INACTIVE', updatedAt: now }, include: { user: { select: { id: true, name: true, email: true } } } });
  });

  it('resolves tenant membership only while active', async () => {
    const { service, db } = setup();
    db.organizationMember.findFirst = vi.fn().mockResolvedValue(null);
    await expect(service.resolveMember('revoked-user', org.id)).rejects.toMatchObject({ status: 404, response: { code: 'ORGANIZATION_NOT_FOUND' } });
    expect(db.organizationMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'revoked-user', organizationId: org.id, status: 'ACTIVE' } }));
  });

  it('prevents removing or degrading the last OWNER', async () => {
    const { service, tx } = setup();
    tx.organizationMember.findFirst = vi.fn().mockResolvedValue(member);
    tx.organizationMember.count = vi.fn().mockResolvedValue(1);

    await expect(
      service.updateMemberRole(member, 'user-id', member.id, { role: 'ADMIN' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'CANNOT_REMOVE_LAST_OWNER' },
    });

    await expect(
      service.removeMember(member, 'user-id', member.id),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'CANNOT_REMOVE_LAST_OWNER' },
    });
  });

  it('restricts ADMIN to only modifying and revoking EMPLOYEE', async () => {
    const { service, tx } = setup();
    const admin = { ...member, id: 'admin-id', role: 'ADMIN' as const };
    const otherAdmin = { ...member, id: 'other-admin-id', role: 'ADMIN' as const };
    tx.organizationMember.findFirst = vi.fn().mockResolvedValue(otherAdmin);

    await expect(
      service.updateMemberRole(admin, 'user-id', otherAdmin.id, { role: 'EMPLOYEE' }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'PERMISSION_DENIED' },
    });

    await expect(
      service.removeMember(admin, 'user-id', otherAdmin.id),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'PERMISSION_DENIED' },
    });
  });

  it('creates an invitation, hashes token and enqueues email via Resend', async () => {
    const { service, tx, emails } = setup();
    tx.organizationMember.findFirst = vi.fn().mockResolvedValue(null);
    tx.organizationInvitation.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    tx.organizationInvitation.create = vi.fn().mockResolvedValue({
      id: 'inv-id',
      organizationId: org.id,
      email: 'nuevo@example.test',
      role: 'EMPLOYEE',
      tokenHash: 'somehash',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 7 * 86400000),
      acceptedAt: null,
      revokedAt: null,
    });

    const res = await service.createInvitation(member, 'user-id', {
      email: 'nuevo@example.test',
      role: 'EMPLOYEE',
    });

    expect(res.token).toBeDefined();
    expect(res.invitation.email).toBe('nuevo@example.test');
    expect(emails.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      to: 'nuevo@example.test',
      subject: expect.stringContaining(org.name),
    }));
  });

  it('accepts an invitation with verified matching email and assigns organization', async () => {
    const { service, tx, identity } = setup({ verified: true });
    const token = 'test-token-value-12345678901234567890';
    const inv = {
      id: 'inv-id',
      organizationId: org.id,
      email: 'a@example.test',
      role: 'EMPLOYEE' as const,
      organization: org,
      expiresAt: new Date(now.getTime() + 86400000),
      revokedAt: null,
      acceptedAt: null,
    };
    tx.organizationInvitation.findUnique = vi.fn().mockResolvedValue(inv);
    tx.organizationInvitation.update = vi.fn().mockResolvedValue({ ...inv, acceptedAt: now });
    tx.organizationMember.findUnique = vi.fn().mockResolvedValue(null);
    tx.organizationMember.create = vi.fn().mockResolvedValue({
      id: 'new-mem-id',
      userId: 'user-id',
      organizationId: org.id,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.acceptInvitation(token, principal);
    expect(result.membership.role).toBe('EMPLOYEE');
    expect(tx.organizationInvitation.update).toHaveBeenCalledWith({
      where: { id: inv.id },
      data: { acceptedAt: now },
    });
    expect(identity.selectOrganization).toHaveBeenCalledWith(tx, principal, org.id);
  });

  it('rejects invitation if email does not match or is unverified', async () => {
    const { service, tx } = setup({ verified: true });
    const inv = {
      id: 'inv-id',
      organizationId: org.id,
      email: 'otro-correo@example.test',
      role: 'EMPLOYEE' as const,
      organization: org,
      expiresAt: new Date(now.getTime() + 86400000),
      revokedAt: null,
      acceptedAt: null,
    };
    tx.organizationInvitation.findUnique = vi.fn().mockResolvedValue(inv);

    await expect(
      service.acceptInvitation('any-token', principal),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'EMAIL_MISMATCH' },

    });
  });
});


