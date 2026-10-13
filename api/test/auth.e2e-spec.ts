import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiHarness, type ApiHarness } from './harness.js';
import { HttpClient } from './http-client.js';
import { SESSION_IDLE_MS } from '../src/identity/session-policy.js';
import { TRIAL_MS } from '../src/subscriptions/subscription.policy.js';
import { sha256 } from '../src/common/crypto.js';

describe('real Nest authentication, tenant and subscription HTTP contract', () => {
  let h: ApiHarness;
  let client: HttpClient;
  beforeAll(async () => { h = await createApiHarness(); });
  beforeEach(async () => { h.clock.advance(3_600_000); client = new HttpClient(h.app); await client.csrf(); });
  afterAll(async () => { await h?.close(); });

  it('register → login → verification → atomic onboarding → workspace → replay', async () => {
    const email = `${randomUUID()}@example.test`, password = 'original strong password';
    const registration = await client.post('/auth/register', { name: '  First Last  ', email: ` ${email.toUpperCase()} `, password }).expect(202);
    expect(registration.body).toEqual({ message: expect.any(String) });
    expect(registration.headers['set-cookie']).toBeUndefined();
    const user = await h.db.user.findUniqueOrThrow({ where: { email } }); h.ownedUsers.add(user.id);
    await h.dispatcher.drain();
    const anonymousCsrf = client.csrfToken;
    const login = await client.login(email, password);
    expect(Object.keys(login.body).sort()).toEqual(['csrfToken', 'user']);
    expect(login.body.user).toMatchObject({ name: 'First Last', email, emailVerifiedAt: null });
    const cookies = login.get('Set-Cookie') ?? [];
    expect(cookies).toHaveLength(2);
    const sessionCookie = cookies.find(value => value.startsWith('nuari_session='))!;
    expect(sessionCookie).toContain('HttpOnly'); expect(sessionCookie).toContain('Path=/'); expect(sessionCookie).toContain('SameSite=Lax'); expect(sessionCookie).not.toContain('Domain='); expect(sessionCookie).not.toContain('Secure');
    const sessionToken = sessionCookie.split(';')[0].slice('nuari_session='.length);
    expect(login.text).not.toContain(sessionToken); expect(login.text).not.toContain(sha256(sessionToken));
    await client.agent.post('/api/auth/logout').set('Origin', client.origin).set('X-CSRF-Token', anonymousCsrf).send({}).expect(403);
    const before = await client.agent.get('/api/auth/me').expect(200);
    expect(before.body).toMatchObject({ memberships: [], activeOrganizationId: null, access: null, onboarding: { canCreateOrganization: false, reason: 'EMAIL_UNVERIFIED' } });
    const input = { name: 'Business', slug: `test-${randomUUID()}`, businessType: 'HOSPITALITY', planCode: 'BASIC' };
    await client.post('/organizations', input).set('Idempotency-Key', randomUUID()).expect(403);
    await client.post('/auth/email-verification/confirm', { token: h.emailSender.token(email, 'verify-email') }).expect(204);
    const key = randomUUID();
    const creation = await client.post('/organizations', input).set('Idempotency-Key', key).expect(201);
    expect(Object.keys(creation.body).sort()).toEqual(['membership', 'organization', 'subscription']);
    expect(creation.body.membership).toMatchObject({ role: 'OWNER', status: 'ACTIVE' });
    const replay = await client.post('/organizations', input).set('Idempotency-Key', key).expect(200);
    expect(replay.body).toEqual(creation.body);
    const snapshot = await client.agent.get('/api/auth/me').expect(200);
    expect(snapshot.headers['cache-control']).toBe('no-store');
    expect(snapshot.body.activeOrganizationId).toBe(creation.body.organization.id);
    const workspace = await client.agent.get(`/api/organizations/${creation.body.organization.id}/workspace`).expect(200);
    expect(workspace.body.access).toMatchObject({ businessAllowed: true, reason: 'TRIAL_ACTIVE' });
    expect(Object.keys(workspace.body).sort()).toEqual(['access', 'evaluatedAt', 'membership', 'organization']);
  });

  it('duplicate register has identical status/body, no changed credentials and no session cookie', async () => {
    const user = await h.user();
    const before = await h.db.userCredential.findUniqueOrThrow({ where: { userId: user.id } });
    const duplicate = await client.post('/auth/register', { name: 'Other Name', email: user.email.toUpperCase(), password: 'different password' }).expect(202);
    const email = `${randomUUID()}@example.test`;
    const fresh = await client.post('/auth/register', { name: 'Other Name', email, password: 'different password' }).expect(202);
    h.ownedUsers.add((await h.db.user.findUniqueOrThrow({ where: { email } })).id);
    expect(duplicate.body).toEqual(fresh.body);
    expect(duplicate.headers['set-cookie']).toBeUndefined();
    expect(fresh.headers['set-cookie']).toBeUndefined();
    expect((await h.db.userCredential.findUniqueOrThrow({ where: { userId: user.id } })).passwordHash).toBe(before.passwordHash);
  });

  it('invalid login is indistinguishable for wrong password and nonexistent email', async () => {
    const user = await h.user();
    const wrong = await client.post('/auth/login', { email: user.email, password: 'wrong password value' }).expect(401);
    const missing = await client.post('/auth/login', { email: `${randomUUID()}@example.test`, password: 'wrong password value' }).expect(401);
    expect(wrong.body).toEqual(missing.body);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    { name: '', email: 'invalid', password: 'short' },
    { name: 42, email: 'valid@example.test', password: 'long enough password' },
    { name: 'Test', email: 'valid@example.test', password: 'long enough password', ownerId: randomUUID() },
    { name: 'Test', email: 'valid@example.test', password: 'long enough password', role: 'OWNER' },
  ])('returns sanitized field errors for invalid/extra registration fields', async body => {
    const result = await client.post('/auth/register', body).expect(400);
    expect(result.body.code).toBe('VALIDATION_ERROR');
    expect(result.body.fieldErrors).toBeDefined();
    expect(result.text).not.toContain('valid@example.test');
    expect(result.text).not.toContain('long enough password');
  });

  it('rejects a body over 16 KiB and malformed JSON', async () => {
    const huge = await client.post('/auth/register', { name: 'x'.repeat(17_000) }).expect(413);
    expect(huge.body.code).toBe('VALIDATION_ERROR');
    const malformed = await client.agent.post('/api/auth/register').set('Origin', client.origin).set('X-CSRF-Token', client.csrfToken).set('Content-Type', 'application/json').send('{"broken"').expect(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');
  });

  it.each(['https://evil.test', 'null', ''])('rejects wrong/missing Origin %s', async origin => {
    const mutation = client.agent.post('/api/auth/login').set('X-CSRF-Token', client.csrfToken).send({ email: 'valid@example.test', password: 'valid password length' });
    if (origin) mutation.set('Origin', origin);
    expect((await mutation.expect(403)).body.code).toBe('CSRF_INVALID');
  });

  it('rejects cross-site metadata, missing CSRF, mismatched double-submit, and non-JSON mutation', async () => {
    await client.post('/auth/logout').set('Sec-Fetch-Site', 'cross-site').expect(403);
    await client.agent.post('/api/auth/logout').set('Origin', client.origin).send({}).expect(403);
    await client.agent.post('/api/auth/logout').set('Origin', client.origin).set('X-CSRF-Token', client.csrfToken + 'x').send({}).expect(403);
    await client.agent.post('/api/auth/login').set('Origin', client.origin).set('X-CSRF-Token', client.csrfToken).type('form').send({ email: 'valid@example.test', password: 'valid password length' }).expect(403);
  });

  it('CSRF GET rejects missing/foreign origin but accepts same-origin browser metadata', async () => {
    await request(h.app.getHttpServer()).get('/api/auth/csrf').expect(403);
    await request(h.app.getHttpServer()).get('/api/auth/csrf').set('Origin', 'https://evil.test').expect(403);
    await request(h.app.getHttpServer()).get('/api/auth/csrf').set('Sec-Fetch-Site', 'same-origin').expect(200);
  });

  it('allows credentialed CORS only for the exact origin and public preflight', async () => {
    const preflight = await request(h.app.getHttpServer()).options('/api/auth/login').set('Origin', client.origin).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'x-csrf-token,content-type').expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(client.origin);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    const foreign = await request(h.app.getHttpServer()).options('/api/auth/login').set('Origin', 'https://evil.test').set('Access-Control-Request-Method', 'POST').expect(204);
    expect(foreign.headers['access-control-allow-origin']).not.toBe('https://evil.test');
  });

  it('shared IP limiter counts successes/failures and cannot be bypassed with forwarded headers', async () => {
    for (let index = 0; index < 10; index++) await client.post('/auth/login', { email: `${randomUUID()}@example.test`, password: 'unknown password value' }).set('X-Forwarded-For', `192.0.2.${index + 1}`).expect(401);
    const limited = await client.post('/auth/login', { email: `${randomUUID()}@example.test`, password: 'unknown password value' }).set('X-Forwarded-For', '203.0.113.99').expect(429);
    expect(limited.body.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('reset request is generic and preserves sessions; confirmation clears cookies and revokes all', async () => {
    const user = await h.user();
    await client.login(user.email, user.password);
    const known = await client.post('/auth/password-reset/request', { email: user.email }).expect(202);
    const unknown = await client.post('/auth/password-reset/request', { email: `${randomUUID()}@example.test` }).expect(202);
    expect(known.body).toEqual(unknown.body);
    await client.agent.get('/api/auth/me').expect(200);
    await h.dispatcher.drain();
    const token = h.emailSender.token(user.email, 'reset-password');
    await request(h.app.getHttpServer()).get(`/api/auth/password-reset/confirm?token=${token}`).expect(404);
    const reset = await client.post('/auth/password-reset/confirm', { token, password: 'new replacement password' }).expect(204);
    expect(reset.headers['set-cookie']).toHaveLength(2);
    await client.agent.get('/api/auth/me').expect(401);
    await h.identity.authenticate(user.token).then(() => { throw new Error('Old session survived reset.'); }, error => expect(error.getStatus()).toBe(401));
    await client.csrf();
    await client.post('/auth/password-reset/confirm', { token, password: 'another replacement password' }).expect(400);
    await client.login(user.email, 'new replacement password');
  });

  it('logout is idempotent even after inactivity expiry and clears equivalent cookies', async () => {
    const user = await h.user();
    await client.login(user.email, user.password);
    h.clock.advance(SESSION_IDLE_MS);
    await client.agent.get('/api/auth/me').expect(401);
    await client.csrf();
    const result = await client.post('/auth/logout').expect(204);
    expect((result.get('Set-Cookie') ?? []).join(' ')).toContain('Path=/');
    await client.csrf();
    await client.post('/auth/logout').expect(204);
  });

  it('expired trial denies workspace but preserves account, subscription and logout', async () => {
    const user = await h.user();
    const result = await h.organizations.createInitial(user.principal, randomUUID(), { name: 'Test', slug: `test-${randomUUID()}`, businessType: 'SERVICES', planCode: 'PRO' });
    await client.login(user.email, user.password);
    await client.agent.get(`/api/organizations/${result.organization.id}/workspace`).expect(200);
    h.clock.advance(TRIAL_MS);
    await h.db.session.updateMany({ where: { userId: user.id }, data: { lastSeenAt: h.clock.now() } });
    const workspace = await client.agent.get(`/api/organizations/${result.organization.id}/workspace`).expect(403);
    expect(workspace.body.code).toBe('SUBSCRIPTION_REQUIRED');
    const subscription = await client.agent.get(`/api/organizations/${result.organization.id}/subscription`).expect(200);
    expect(subscription.body).toMatchObject({ subscription: { status: 'EXPIRED' }, access: { businessAllowed: false, reason: 'TRIAL_EXPIRED' } });
    await client.agent.get('/api/auth/me').expect(200);
    await client.csrf(); await client.post('/auth/logout').expect(204);
  });

  it('all roles may read their own subscription; employee/multi-org context is membership-based', async () => {
    const [owner, other, employee] = await Promise.all([h.user(), h.user(), h.user({ verified: false })]);
    const org1 = await h.organizations.createInitial(owner.principal, randomUUID(), { name: 'First', slug: `test-${randomUUID()}`, businessType: 'SERVICES', planCode: 'BASIC' });
    const org2 = await h.organizations.createInitial(other.principal, randomUUID(), { name: 'Second', slug: `test-${randomUUID()}`, businessType: 'COMMERCE', planCode: 'BUSINESS' });
    const member1 = await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: org1.organization.id, role: 'EMPLOYEE', status: 'ACTIVE', createdAt: new Date(h.clock.now().getTime() - 1000) } });
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: org2.organization.id, role: 'ADMIN', status: 'ACTIVE', createdAt: h.clock.now() } });
    await client.login(employee.email, employee.password);
    const me = await client.agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ activeOrganizationId: org1.organization.id, onboarding: { reason: 'HAS_MEMBERSHIP' }, access: { canManageSubscription: false } });
    expect(me.body.memberships).toHaveLength(2);
    await client.agent.get(`/api/organizations/${org1.organization.id}/subscription`).expect(200);
    const selection = await client.post('/auth/active-organization', { organizationId: org2.organization.id }).expect(200);
    expect(selection.body.access.canManageSubscription).toBe(true);
    await h.db.organizationMember.update({ where: { id: member1.id }, data: { status: 'INACTIVE' } });
    const forbidden = await client.agent.get(`/api/organizations/${org1.organization.id}/subscription`).expect(404);
    const unknown = await client.agent.get(`/api/organizations/${randomUUID()}/subscription`).expect(404);
    expect(forbidden.body).toEqual(unknown.body);
    await client.agent.get(`/api/organizations/${org1.organization.id}/workspace`).expect(404);
  });

  it('validates onboarding keys/enums/reserved slugs/unknown fields and exposes only the closed plan catalog', async () => {
    const user = await h.user(); await client.login(user.email, user.password);
    const plans = await client.agent.get('/api/subscription-plans').expect(200);
    expect(plans.body).toEqual({ plans: ['BASIC', 'PRO', 'BUSINESS', 'TOURISM'].map(code => ({ code })), trialDays: 14 });
    const input = { name: 'Test', slug: `test-${randomUUID()}`, businessType: 'SERVICES', planCode: 'PRO' };
    expect((await client.post('/organizations', input).expect(400)).body.code).toBe('INVALID_IDEMPOTENCY_KEY');
    for (const bad of [{ slug: 'api' }, { slug: 'Bad' }, { planCode: 'UNKNOWN' }, { businessType: 'UNKNOWN' }, { trialEndsAt: '2099-01-01' }, { role: 'OWNER' }, { paidThrough: '2099-01-01' }]) {
      const result = await client.post('/organizations', { ...input, ...bad }).set('Idempotency-Key', randomUUID()).expect(400);
      expect(result.body.code).toBe('VALIDATION_ERROR'); expect(result.body.fieldErrors).toBeDefined();
    }
    await client.post('/auth/active-organization', { organizationId: 'not-a-uuid' }).expect(400);
    await client.agent.get('/api/organizations/not-a-uuid/workspace').expect(400);
  });
});
