import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiHarness, type ApiHarness } from './harness.js';
import { CsrfService } from '../src/common/csrf.js';
import { SecurityConfig } from '../src/common/security.config.js';

type TestUser = Awaited<ReturnType<ApiHarness['user']>>;

function session(h: ApiHarness, user: TestUser) {
  const config = h.app.get(SecurityConfig);
  const csrf = h.app.get(CsrfService).issue(user.token);
  const cookie = `${config.sessionCookie}=${user.token}; ${config.csrfCookie}=${csrf}`;
  const client = request(h.app.getHttpServer());
  const read = (path: string) => client.get(`/api/organizations/${path}`).set('Cookie', cookie);
  const write = (method: 'post' | 'patch', path: string, body: Record<string, unknown>, etag?: string) => {
    const req = client[method](`/api/organizations/${path}`).set('Cookie', cookie)
      .set('Origin', config.webOrigin).set('X-CSRF-Token', csrf);
    if (etag !== undefined) req.set('If-Match', etag);
    return req.send(body);
  };
  return { read, write };
}

async function createOrganization(h: ApiHarness, owner: TestUser) {
  const created = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: 'Staff test', slug: `staff-${randomUUID().slice(0, 12)}`,
    businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(created.organization.id);
  return created.organization;
}

describe('staff API against authorized development PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness(); });
  afterAll(async () => { await h?.close(); });

  it('keeps operational staff separate from access membership and protects contact details', async () => {
    const owner = await h.user();
    const employee = await h.user();
    const otherOwner = await h.user();
    const organization = await createOrganization(h, owner);
    const otherOrganization = await createOrganization(h, otherOwner);
    await h.db.organizationMember.create({ data: {
      userId: employee.id, organizationId: organization.id, role: 'EMPLOYEE', status: 'ACTIVE',
    } });
    const ownerApi = session(h, owner);
    const employeeApi = session(h, employee);
    const before = await Promise.all([
      h.db.user.count(), h.db.organizationMember.count(), h.db.organizationInvitation.count(), h.db.session.count(),
    ]);

    const created = await ownerApi.write('post', `${organization.id}/staff`, {
      name: '  Alex Pérez  ', email: ' ALEX@example.test ', phone: '+54 11 1234-5678',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ organizationId: organization.id, name: 'Alex Pérez', active: true, userId: null, version: 1 });
    expect(created.headers.etag).toBe('"1"');
    expect(await Promise.all([
      h.db.user.count(), h.db.organizationMember.count(), h.db.organizationInvitation.count(), h.db.session.count(),
    ])).toEqual(before);

    const directory = await employeeApi.read(`${organization.id}/staff`);
    expect(directory.status).toBe(200);
    expect(directory.body.items[0]).toMatchObject({ id: created.body.id, name: 'Alex Pérez', active: true });
    expect(directory.body.items[0]).not.toHaveProperty('email');
    expect(directory.body.items[0]).not.toHaveProperty('phone');
    expect(directory.body.items[0]).not.toHaveProperty('userId');
    expect((await employeeApi.read(`${organization.id}/staff/${created.body.id}`)).status).toBe(403);
    expect((await ownerApi.read(`${otherOrganization.id}/staff/${created.body.id}`)).status).toBe(404);
    expect((await ownerApi.write('post', `${organization.id}/staff`, { name: 'Invalid link', userId: employee.id })).status).toBe(400);
    expect((await ownerApi.write('post', `${organization.id}/staff`, { name: 'Invalid role', role: 'ADMIN' })).status).toBe(400);

    const update = await ownerApi.write('patch', `${organization.id}/staff/${created.body.id}`, { phone: null }, '"1"');
    expect(update.status).toBe(200);
    expect(update.body.phone).toBeNull();
    expect(update.headers.etag).toBe('"2"');
    expect((await ownerApi.write('patch', `${organization.id}/staff/${created.body.id}`, { name: 'Stale' }, '"1"')).status).toBe(412);
    const archived = await ownerApi.write('patch', `${organization.id}/staff/${created.body.id}`, { active: false }, '"2"');
    expect(archived.status).toBe(200);
    expect(archived.body.active).toBe(false);
    expect(archived.body.version).toBe(3);
  });
});
