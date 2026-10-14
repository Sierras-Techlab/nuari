import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApiHarness, type ApiHarness } from './harness.js';
import { PasswordHasher } from '../src/identity/password-hasher.js';
import { IdentityService } from '../src/identity/identity.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityConfig } from '../src/common/security.config.js';
import { SESSION_IDLE_MS, SESSION_ABSOLUTE_MS } from '../src/identity/session-policy.js';
import { sha256 } from '../src/common/crypto.js';
import { EmailDispatcher } from '../src/integrations/email-dispatcher.js';
import { EmailSender, type EmailMessage } from '../src/integrations/email-sender.js';
import request from 'supertest';

class FailingEmailSender extends EmailSender {
  async send(_message: EmailMessage): Promise<void> { throw new Error('test delivery failure'); }
}
import * as argon2 from 'argon2';

describe('identity against isolated PostgreSQL', () => {
  let h: ApiHarness;
  let secondDb: PrismaService;
  let secondIdentity: IdentityService;
  beforeAll(async () => {
    h = await createApiHarness();
    secondDb = new PrismaService();
    await secondDb.$connect();
    secondIdentity = new IdentityService(secondDb, h.app.get(PasswordHasher), h.clock, h.dispatcher, h.app.get(SecurityConfig));
  });
  afterAll(async () => { await secondDb?.$disconnect(); await h?.close(); });

  it('normalised concurrent registration creates one identity/credential/token, no tenant or session', async () => {
    const email = `${randomUUID()}@example.test`;
    const input = { name: 'New Account', email, password: 'long unchanged password' };
    await Promise.all([h.identity.register(input), secondIdentity.register(input)]);
    const user = await h.db.user.findUniqueOrThrow({ where: { email }, include: { credential: true, sessions: true, memberships: true, emailVerificationTokens: true } });
    h.ownedUsers.add(user.id);
    expect(user.credential?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.sessions).toHaveLength(0);
    expect(user.memberships).toHaveLength(0);
    expect(user.emailVerificationTokens).toHaveLength(1);
    const original = user.credential?.passwordHash;
    await h.identity.register({ ...input, password: 'different duplicate password' });
    expect((await h.db.userCredential.findUniqueOrThrow({ where: { userId: user.id } })).passwordHash).toBe(original);
  });

  it('persists member revocation, excludes it from active lists, and denies tenant endpoints without ending the session', async () => {
    const owner = await h.user();
    const employee = await h.user();
    const created = await h.organizations.createInitial(owner.principal, randomUUID(), { name: 'Revocation test', slug: `revoke-${randomUUID().slice(0, 8)}`, businessType: 'SERVICES', planCode: 'BASIC' });
    h.ownedOrganizations.add(created.organization.id);
    const employeeMembership = await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: created.organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });
    const ownerMembership = await h.db.organizationMember.findUniqueOrThrow({ where: { id: created.membership.id } });

    await h.organizations.removeMember(ownerMembership, owner.id, employeeMembership.id);

    await expect(h.db.organizationMember.findUniqueOrThrow({ where: { id: employeeMembership.id } })).resolves.toMatchObject({ status: 'INACTIVE' });
    await expect(h.organizations.listMembers(created.organization.id)).resolves.toEqual(expect.not.arrayContaining([expect.objectContaining({ id: employeeMembership.id })]));
    const session = await h.db.session.findUniqueOrThrow({ where: { id: employee.principal.sessionId } });
    expect(session.revokedAt).toBeNull();
    const snapshot = await h.organizations.snapshot(employee.principal);
    expect(snapshot).toMatchObject({ memberships: [], activeOrganizationId: null, onboarding: { reason: 'ACCESS_REVOKED' } });

    const response = await request(h.app.getHttpServer())
      .get(`/api/organizations/${created.organization.id}/members`)
      .set('Cookie', `${h.app.get(SecurityConfig).sessionCookie}=${employee.token}`);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'ORGANIZATION_NOT_FOUND' });
  });

  it('uses opaque session tokens, rotates identity, and does not extend absolute expiry', async () => {
    const user = await h.user();
    const stored = await h.db.session.findUniqueOrThrow({ where: { id: user.principal.sessionId } });
    expect(stored.tokenHash).toBe(sha256(user.token));
    expect(stored.tokenHash).not.toBe(user.token);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(SESSION_ABSOLUTE_MS);
    const next = await h.identity.login(user.email, user.password, user.token);
    expect(next.token).not.toBe(user.token);
    await expect(h.identity.authenticate(user.token)).rejects.toMatchObject({ status: 401 });
    h.clock.advance(60_000);
    const principal = await h.identity.authenticate(next.token);
    expect((await h.db.session.findUniqueOrThrow({ where: { id: principal.sessionId } })).expiresAt).toEqual(next.expiresAt);
  });

  it('denies exact inactivity and absolute expiry; a version mismatch cannot revive a session', async () => {
    const user = await h.user();
    const now = h.clock.now();
    await h.db.session.update({ where: { id: user.principal.sessionId }, data: { lastSeenAt: new Date(now.getTime() - SESSION_IDLE_MS) } });
    await expect(h.identity.authenticate(user.token)).rejects.toMatchObject({ status: 401 });
    const fresh = await h.identity.login(user.email, user.password);
    const principal = await h.identity.authenticate(fresh.token);
    await h.db.session.update({ where: { id: principal.sessionId }, data: { createdAt: new Date(now.getTime() - 1000), expiresAt: now } });
    await expect(h.identity.authenticate(fresh.token)).rejects.toMatchObject({ status: 401 });
    const versioned = await h.identity.login(user.email, user.password);
    await h.db.userCredential.update({ where: { userId: user.id }, data: { version: { increment: 1 } } });
    await expect(h.identity.authenticate(versioned.token)).rejects.toMatchObject({ status: 401 });
  });

  it('rehashes a weaker valid PHC without changing the credential version', async () => {
    const user = await h.user();
    const weak = await argon2.hash(user.password, { type: argon2.argon2id, memoryCost: 8192, timeCost: 1, parallelism: 1 });
    await h.db.userCredential.update({ where: { userId: user.id }, data: { passwordHash: weak } });
    const login = await h.identity.login(user.email, user.password);
    const credential = await h.db.userCredential.findUniqueOrThrow({ where: { userId: user.id } });
    expect(credential.version).toBe(1);
    expect(h.app.get(PasswordHasher).needsRehash(credential.passwordHash)).toBe(false);
    await h.identity.authenticate(login.token);
    await h.identity.authenticate(user.token);
  });

  it('consumes verification once across separate connections and keeps purposes separate', async () => {
    const user = await h.user({ verified: false });
    const token = h.emailSender.token(user.email, 'verify-email');
    await expect(h.identity.confirmPasswordReset(token, 'replacement password')).rejects.toMatchObject({ status: 400 });
    const results = await Promise.allSettled([h.identity.confirmVerification(token), secondIdentity.confirmVerification(token)]);
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(2);
    expect((await h.db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
  });

  it('treats a repeated confirmation by the already verified account as idempotent', async () => {
    const user = await h.user({ verified: false });
    const token = h.emailSender.token(user.email, 'verify-email');

    await h.identity.confirmVerification(token);
    await expect(h.identity.confirmVerification(token)).resolves.toBeUndefined();
  });

  it('keeps the previous verification token when a resend cannot be delivered', async () => {
    const user = await h.user({ verified: false });
    const oldToken = h.emailSender.token(user.email, 'verify-email');
    const failingDispatcher = new EmailDispatcher(new FailingEmailSender());
    const failingIdentity = new IdentityService(secondDb, h.app.get(PasswordHasher), h.clock, failingDispatcher, h.app.get(SecurityConfig));

    await failingIdentity.requestVerification(user.id);
    await failingDispatcher.drain();
    await expect(h.identity.confirmVerification(oldToken)).resolves.toBeUndefined();
  });

  it('includes a validated invitation return path in verification email links', async () => {
    const email = `${randomUUID()}@example.test`;
    await h.identity.register({ name: 'Invited User', email, password: 'long unchanged password', returnTo: '/invitacion/invitation-token-123456789' });
    const user = await h.db.user.findUniqueOrThrow({ where: { email } });
    h.ownedUsers.add(user.id);
    await h.dispatcher.drain();

    const message = h.emailSender.messages.find(item => item.to === email);
    expect(message && new URL(message.text).searchParams.get('returnTo')).toBe('/invitacion/invitation-token-123456789');
  });

  it('serializes resends and invalidates old verification tokens', async () => {
    const user = await h.user({ verified: false });
    const old = h.emailSender.token(user.email, 'verify-email');
    await Promise.all([h.identity.requestVerification(user.id), secondIdentity.requestVerification(user.id)]);
    await h.dispatcher.drain();
    const activeTokens = await h.db.emailVerificationToken.findMany({ where: { userId: user.id, consumedAt: null }, select: { id: true, tokenHash: true } });
    expect(activeTokens).toHaveLength(1);
    await expect(h.identity.confirmVerification(old)).rejects.toMatchObject({ status: 400 });
    const active = await h.db.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id, consumedAt: null } });
    const sent = h.emailSender.messages.filter(message => message.to === user.email).map(message => new URL(message.text).hash.slice(7)).find(token => sha256(token) === active.tokenHash);
    expect(sent).toBeDefined();
    await h.identity.confirmVerification(sent!);
  });

  it('denies verification and reset exactly at token expiry', async () => {
    const user = await h.user({ verified: false });
    const verification = h.emailSender.token(user.email, 'verify-email');
    await h.db.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(h.clock.now().getTime() - 1000), expiresAt: h.clock.now() } });
    await expect(h.identity.confirmVerification(verification)).rejects.toMatchObject({ status: 400 });
    await h.identity.requestPasswordReset(user.email);
    await h.dispatcher.drain();
    const reset = h.emailSender.token(user.email, 'reset-password');
    await h.db.passwordResetToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(h.clock.now().getTime() - 1000), expiresAt: h.clock.now() } });
    await expect(h.identity.confirmPasswordReset(reset, 'replacement password')).rejects.toMatchObject({ status: 400 });
  });

  it('request does not revoke; one concurrent reset consumes tokens, increments version and revokes every session', async () => {
    const user = await h.user();
    const second = await h.identity.login(user.email, user.password);
    await h.identity.requestPasswordReset(user.email);
    await h.dispatcher.drain();
    await h.identity.authenticate(user.token);
    const token = h.emailSender.token(user.email, 'reset-password');
    const outcomes = await Promise.allSettled([h.identity.confirmPasswordReset(token, 'new correct password'), secondIdentity.confirmPasswordReset(token, 'other correct password')]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await h.db.userCredential.findUniqueOrThrow({ where: { userId: user.id } })).version).toBe(2);
    expect(await h.db.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    await expect(h.identity.authenticate(user.token)).rejects.toMatchObject({ status: 401 });
    await expect(h.identity.authenticate(second.token)).rejects.toMatchObject({ status: 401 });
  });

  it('a login observed before reset cannot commit an old-password session afterward', async () => {
    const user = await h.user();
    await h.identity.requestPasswordReset(user.email);
    await h.dispatcher.drain();
    const hasher = h.app.get(PasswordHasher);
    const original = hasher.verify.bind(hasher);
    let verified!: () => void;
    let release!: () => void;
    const observed = new Promise<void>(resolve => { verified = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const spy = vi.spyOn(hasher, 'verify').mockImplementationOnce(async (hash, password) => {
      const result = await original(hash, password); verified(); await gate; return result;
    });
    const login = h.identity.login(user.email, user.password);
    const assertion = expect(login).rejects.toMatchObject({ status: 401 });
    try {
      await observed;
      await secondIdentity.confirmPasswordReset(h.emailSender.token(user.email, 'reset-password'), 'new replacement password');
      release();
      await assertion;
      expect(await h.db.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    } finally { release(); spy.mockRestore(); }
  });

  it('shared rate limiter has exactly one atomic allowance across independent PostgreSQL clients', async () => {
    const { RateLimiter } = await import('../src/common/rate-limiter.js');
    const second = new RateLimiter(secondDb, h.clock, h.app.get(SecurityConfig));
    const scope = `test-${h.runId}`;
    const identity = randomUUID();
    const results = await Promise.allSettled(Array.from({ length: 15 }, (_, index) => (index % 2 ? h.rateLimiter : second).consume(scope, identity, 5, 60_000)));
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(5);
    expect(results.filter(item => item.status === 'rejected')).toHaveLength(10);
    const bucket = await h.db.rateLimitBucket.findFirstOrThrow({ where: { scope } });
    expect(bucket.count).toBe(6);
    expect(bucket.keyHash).not.toContain(identity);
    h.clock.advance(60_000);
    await h.rateLimiter.consume(scope, identity, 5, 60_000);
  });
});
