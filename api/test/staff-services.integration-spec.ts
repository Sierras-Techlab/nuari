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
  const path = (suffix: string) => `/api/organizations/${suffix}`;
  const read = (suffix: string) => client.get(path(suffix)).set('Cookie', cookie);
  const write = (method: 'post' | 'patch' | 'put' | 'delete', suffix: string, body: Record<string, unknown> = {}, etag?: string) => {
    const req = client[method](path(suffix)).set('Cookie', cookie)
      .set('Origin', config.webOrigin).set('X-CSRF-Token', csrf);
    if (etag !== undefined) req.set('If-Match', etag);
    return req.send(body);
  };
  return { read, write };
}

async function createOrganization(h: ApiHarness, owner: TestUser) {
  const created = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: 'Staff services test', slug: `staff-services-${randomUUID().slice(0, 10)}`,
    businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(created.organization.id);
  return created.organization;
}

describe('staff-service API against authorized development PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness(); });
  afterAll(async () => { await h?.close(); });

  it('supports tenant-safe, versioned, idempotent associations from both directions', async () => {
    const owner = await h.user();
    const otherOwner = await h.user();
    const organization = await createOrganization(h, owner);
    const otherOrganization = await createOrganization(h, otherOwner);
    const api = session(h, owner);
    const otherApi = session(h, otherOwner);
    const service = await api.write('post', `${organization.id}/services`, {
      name: 'Corte', durationMinutes: 30, staffSelectionMode: 'CUSTOMER_CHOICE',
    });
    const staff = await api.write('post', `${organization.id}/staff`, { name: 'Alex', email: 'private@example.test', phone: '+541112345678' });
    const foreignService = await otherApi.write('post', `${otherOrganization.id}/services`, {
      name: 'Masaje', durationMinutes: 30, staffSelectionMode: 'NO_ASSIGNMENT',
    });
    const foreignStaff = await otherApi.write('post', `${otherOrganization.id}/staff`, { name: 'Sam' });
    expect(service.status).toBe(201);
    expect(staff.status).toBe(201);
    expect(foreignService.status).toBe(201);
    expect(foreignStaff.status).toBe(201);

    const path = `${organization.id}/services/${service.body.id}/staff/${staff.body.id}`;
    expect((await api.write('put', path)).status).toBe(428);
    expect((await api.write('put', `${organization.id}/services/${foreignService.body.id}/staff/${staff.body.id}`, {}, '"1"')).status).toBe(404);
    expect((await api.write('put', `${organization.id}/services/${service.body.id}/staff/${foreignStaff.body.id}`, {}, '"1"')).status).toBe(404);

    const assigned = await api.write('put', path, {}, '"1"');
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
    expect(assigned.body.serviceVersion).toBe(2);
    expect(assigned.headers.etag).toBe('"2"');
    expect(assigned.body.association).toMatchObject({
      organizationId: organization.id,
      serviceId: service.body.id,
      staffMemberId: staff.body.id,
      staff: { id: staff.body.id, name: 'Alex', active: true },
      service: { id: service.body.id, name: 'Corte', active: true },
    });
    expect(assigned.body.association.staff).not.toHaveProperty('email');
    expect(assigned.body.association.staff).not.toHaveProperty('phone');
    expect(assigned.body.association.staff).not.toHaveProperty('userId');
    expect((await api.write('put', path, {}, '"1"')).status).toBe(412);
    const repeatedPut = await api.write('put', path, {}, '"2"');
    expect(repeatedPut.status).toBe(200);
    expect(repeatedPut.body.serviceVersion).toBe(2);

    const serviceLinks = await api.read(`${organization.id}/services/${service.body.id}/staff`);
    const staffLinks = await api.read(`${organization.id}/staff/${staff.body.id}/services`);
    expect(serviceLinks.body.items).toHaveLength(1);
    expect(staffLinks.body.items).toHaveLength(1);
    expect(serviceLinks.body.items[0].staff).not.toHaveProperty('email');
    expect(staffLinks.body.items[0].service).toMatchObject({ id: service.body.id, name: 'Corte', active: true });

    const archivedStaff = await api.write('patch', `${organization.id}/staff/${staff.body.id}`, { active: false }, '"1"');
    const archivedService = await api.write('patch', `${organization.id}/services/${service.body.id}`, { active: false }, '"2"');
    expect(archivedStaff.status).toBe(200);
    expect(archivedService.status).toBe(200);
    expect((await api.write('put', path, {}, '"3"')).status).toBe(200); // Existing association remains idempotent while inactive.
    expect((await api.write('delete', path, {}, '"2"')).status).toBe(412);
    const removed = await api.write('delete', path, {}, '"3"');
    expect(removed.status).toBe(200);
    expect(removed.body.serviceVersion).toBe(4);
    expect(removed.headers.etag).toBe('"4"');
    const repeatedDelete = await api.write('delete', path, {}, '"4"');
    expect(repeatedDelete.status).toBe(200);
    expect(repeatedDelete.body.serviceVersion).toBe(4);
    expect((await api.read(`${organization.id}/services/${service.body.id}/staff?status=all`)).body.items).toHaveLength(0);
  });

  it('does not create a new association to a staff member concurrently archived', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const api = session(h, owner);
    const service = await api.write('post', `${organization.id}/services`, {
      name: 'Consulta', durationMinutes: 30, staffSelectionMode: 'CUSTOMER_CHOICE',
    });
    const staff = await api.write('post', `${organization.id}/staff`, { name: 'Rae' });
    const associationPath = `${organization.id}/services/${service.body.id}/staff/${staff.body.id}`;
    const [association, archived] = await Promise.all([
      api.write('put', associationPath, {}, '"1"'),
      api.write('patch', `${organization.id}/staff/${staff.body.id}`, { active: false }, '"1"'),
    ]);
    expect(archived.status).toBe(200);
    expect([200, 409]).toContain(association.status);
    const relation = await h.db.staffService.findFirst({ where: { organizationId: organization.id, serviceId: service.body.id, staffMemberId: staff.body.id } });
    if (association.status === 409) expect(relation).toBeNull();
    if (association.status === 200) expect(relation).not.toBeNull();
    expect((await h.db.staffMember.findFirstOrThrow({ where: { id: staff.body.id, organizationId: organization.id } })).active).toBe(false);
  });
});
