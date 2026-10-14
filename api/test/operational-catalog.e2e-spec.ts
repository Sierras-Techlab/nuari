import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CsrfService } from '../src/common/csrf.js';
import { SecurityConfig } from '../src/common/security.config.js';
import { createApiHarness, MutableClock, type ApiHarness } from './harness.js';

type TestUser = Awaited<ReturnType<ApiHarness['user']>>;

function client(h: ApiHarness, user?: TestUser) {
  const http = request(h.app.getHttpServer());
  const config = h.app.get(SecurityConfig);
  const csrf = user ? h.app.get(CsrfService).issue(user.token) : null;
  const cookie = user ? `${config.sessionCookie}=${user.token}; ${config.csrfCookie}=${csrf}` : '';
  const read = (path: string) => http.get(`/api/organizations/${path}`).set('Cookie', cookie);
  const write = (method: 'post' | 'patch' | 'put' | 'delete', path: string, body: Record<string, unknown> = {}, etag?: string) => {
    const req = http[method](`/api/organizations/${path}`).set('Cookie', cookie).set('Origin', config.webOrigin);
    if (csrf) req.set('X-CSRF-Token', csrf);
    if (etag) req.set('If-Match', etag);
    return req.send(body);
  };
  return { read, write };
}

async function createOrganization(h: ApiHarness, owner: TestUser, label: string) {
  const result = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: label, slug: `operational-${randomUUID().slice(0, 12)}`, businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(result.organization.id);
  return result.organization;
}

describe('operational catalog HTTP boundary against authorized development PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness({ clock: new MutableClock(new Date('2035-01-01T00:00:00.000Z')) }); });
  afterAll(async () => { await h?.close(); });

  it('enforces tenant, permission, version and subscription boundaries while preserving staff links', async () => {
    const anonymous = client(h);
    const owner = await h.user();
    const employee = await h.user();
    const otherOwner = await h.user();
    const organization = await createOrganization(h, owner, 'Operational test');
    const otherOrganization = await createOrganization(h, otherOwner, 'Other tenant');
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });
    const ownerApi = client(h, owner);
    const employeeApi = client(h, employee);
    const otherApi = client(h, otherOwner);
    const route = (organizationId: string, suffix: string) => `${organizationId}/${suffix}`;

    expect((await anonymous.read(`${organization.id}/staff`)).status).toBe(401);
    const beforeStaff = await h.db.organizationMember.count({ where: { organizationId: organization.id } });
    const beforeInvitations = await h.db.organizationInvitation.count({ where: { organizationId: organization.id } });
    const staffResult = await ownerApi.write('post', route(organization.id, 'staff'), { name: 'Sofía Romano', email: 'sofia@example.test' });
    expect(staffResult.status).toBe(201);
    expect(staffResult.body.userId).toBeNull();
    expect(await h.db.organizationMember.count({ where: { organizationId: organization.id } })).toBe(beforeStaff);
    expect(await h.db.organizationInvitation.count({ where: { organizationId: organization.id } })).toBe(beforeInvitations);
    const staffId = staffResult.body.id as string;

    const serviceResult = await ownerApi.write('post', route(organization.id, 'services'), { name: 'Corte', durationMinutes: 30, staffSelectionMode: 'CUSTOMER_CHOICE' });
    const customerResult = await ownerApi.write('post', route(organization.id, 'customers'), { name: 'Ana Pérez' });
    expect(serviceResult.status).toBe(201);
    expect(customerResult.status).toBe(201);
    const serviceId = serviceResult.body.id as string;
    const serviceRoute = `services/${serviceId}/staff/${staffId}`;

    const employeeDirectory = await employeeApi.read(`${organization.id}/staff`);
    expect(employeeDirectory.status).toBe(200);
    expect(employeeDirectory.body.items[0]).not.toHaveProperty('email');
    expect(employeeDirectory.body.items[0]).not.toHaveProperty('phone');
    expect((await employeeApi.read(`${organization.id}/staff/${staffId}`)).status).toBe(403);
    expect((await employeeApi.write('post', route(organization.id, 'staff'), { name: 'No autorizado' })).status).toBe(403);

    const foreignStaff = await otherApi.write('post', route(otherOrganization.id, 'staff'), { name: 'Sam Lee' });
    const foreignRead = await otherApi.read(`${otherOrganization.id}/staff/${staffId}`);
    expect(foreignRead.status).toBe(404);
    expect(foreignRead.body.code).toBe('STAFF_MEMBER_NOT_FOUND');
    expect(foreignStaff.status).toBe(201);
    expect((await ownerApi.write('put', route(organization.id, `services/${serviceId}/staff/${foreignStaff.body.id as string}`), {}, '"1"')).status).toBe(404);

    const assigned = await ownerApi.write('put', route(organization.id, serviceRoute), {}, '"1"');
    expect(assigned.status).toBe(200);
    expect((await ownerApi.read(`${organization.id}/staff/${staffId}/services`)).body.items).toHaveLength(1);
    expect((await ownerApi.write('patch', `${organization.id}/staff/${staffId}`, { name: 'Cambio obsoleto' }, '"2"')).status).toBe(412);
    const archived = await ownerApi.write('patch', `${organization.id}/staff/${staffId}`, { active: false }, '"1"');
    expect(archived.status).toBe(200);
    expect((await ownerApi.read(`${organization.id}/staff/${staffId}/services`)).body.items).toHaveLength(1);
    expect((await ownerApi.write('patch', `${organization.id}/staff/${staffId}`, { active: true }, '"2"')).status).toBe(200);

    await h.db.organizationMember.update({ where: { userId_organizationId: { userId: employee.id, organizationId: organization.id } }, data: { status: 'INACTIVE' } });
    const revokedAccess = await employeeApi.read(`${organization.id}/staff`);
    expect(revokedAccess.status).toBe(404);
    expect(revokedAccess.body.code).toBe('ORGANIZATION_NOT_FOUND');

    h.clock.advance(13 * 24 * 60 * 60 * 1000);
    const renewedSession = await h.identity.login(owner.email, owner.password);
    const currentOwnerApi = client(h, { ...owner, token: renewedSession.token });
    h.clock.advance(2 * 24 * 60 * 60 * 1000);
    const expiredAccess = await currentOwnerApi.read(`${organization.id}/staff`);
    expect(expiredAccess.status).toBe(403);
    expect(expiredAccess.body.code).toBe('SUBSCRIPTION_REQUIRED');
  });
});
