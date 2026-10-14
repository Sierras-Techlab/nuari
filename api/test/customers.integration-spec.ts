import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiHarness, type ApiHarness } from './harness.js';
import { CsrfService } from '../src/common/csrf.js';
import { SecurityConfig } from '../src/common/security.config.js';

type TestUser = Awaited<ReturnType<ApiHarness['user']>>;
type TestOrganization = { id: string; slug: string };

function session(h: ApiHarness, user: TestUser) {
  const config = h.app.get(SecurityConfig);
  const csrf = h.app.get(CsrfService).issue(user.token);
  const cookie = `${config.sessionCookie}=${user.token}; ${config.csrfCookie}=${csrf}`;
  const base = `/api/organizations`;
  const client = request(h.app.getHttpServer());
  const read = (path: string) => client.get(`${base}/${path}`).set('Cookie', cookie);
  const create = (organizationId: string, body: Record<string, unknown>) => client
    .post(`${base}/${organizationId}/customers`)
    .set('Cookie', cookie)
    .set('Origin', config.webOrigin)
    .set('X-CSRF-Token', csrf)
    .send(body);
  const createWithoutCsrf = (organizationId: string, body: Record<string, unknown>) => client
    .post(`${base}/${organizationId}/customers`)
    .set('Cookie', `${config.sessionCookie}=${user.token}`)
    .set('Origin', config.webOrigin)
    .send(body);
  const patch = (organizationId: string, customerId: string, body: Record<string, unknown>, ifMatch?: string) => {
    const req = client.patch(`${base}/${organizationId}/customers/${customerId}`)
      .set('Cookie', cookie)
      .set('Origin', config.webOrigin)
      .set('X-CSRF-Token', csrf);
    if (ifMatch !== undefined) req.set('If-Match', ifMatch);
    return req.send(body);
  };
  return { read, create, createWithoutCsrf, patch };
}

async function createOrganization(h: ApiHarness, owner: TestUser): Promise<TestOrganization> {
  const created = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: 'Customer API test',
    slug: `customer-${randomUUID().slice(0, 12)}`,
    businessType: 'SERVICES',
    planCode: 'BASIC',
  });
  h.ownedOrganizations.add(created.organization.id);
  return created.organization;
}

describe('customer API against authorized development PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness(); });
  afterAll(async () => { await h?.close(); });

  it('keeps customers tenant-scoped and omits private notes from employee projections', async () => {
    const owner = await h.user();
    const employee = await h.user();
    const otherOwner = await h.user();
    const organization = await createOrganization(h, owner);
    const otherOrganization = await createOrganization(h, otherOwner);
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });

    const created = await session(h, owner).create(organization.id, {
      name: '  Ana Pérez  ',
      email: ' Ana.Perez+turno@Example.test ',
      phone: '+54 (11) 4444-5555',
      notes: 'Preferencia privada',
    });
    expect(created.status).toBe(201);
    expect(created.headers.etag).toBe('"1"');
    expect(created.body).toMatchObject({
      id: expect.any(String), organizationId: organization.id, name: 'Ana Pérez',
      email: 'ana.perez+turno@example.test', phone: '+54 (11) 4444-5555',
      notes: 'Preferencia privada', active: true, version: 1,
    });
    const customerId = created.body.id as string;
    const audit = await h.db.organizationAuditLog.findFirstOrThrow({ where: { organizationId: organization.id, targetId: customerId } });
    expect(audit.action).toBe('CUSTOMER_CREATED');
    expect(JSON.parse(audit.metadata!)).toEqual({ changedFields: ['name', 'phone', 'email', 'notes'] });
    expect(audit.metadata).not.toContain('Preferencia privada');
    expect(audit.metadata).not.toContain('ana.perez+turno@example.test');

    const employeeDetail = await session(h, employee).read(`${organization.id}/customers/${customerId}`);
    expect(employeeDetail.status).toBe(200);
    expect(employeeDetail.body).toMatchObject({ id: customerId, name: 'Ana Pérez', phone: '+54 (11) 4444-5555' });
    expect(employeeDetail.body).not.toHaveProperty('notes');
    const summary = await session(h, owner).read(`${organization.id}/customers`);
    expect(summary.body.items[0]).not.toHaveProperty('notes');
    expect((await session(h, owner).read(`${organization.id}/customers?limit=1.5`)).status).toBe(400);

    const otherTenantDetail = await session(h, otherOwner).read(`${otherOrganization.id}/customers/${customerId}`);
    expect(otherTenantDetail.status).toBe(404);
    expect(otherTenantDetail.body).toMatchObject({ code: 'CUSTOMER_NOT_FOUND' });
    const otherTenantList = await session(h, otherOwner).read(`${otherOrganization.id}/customers`);
    expect(otherTenantList.status).toBe(200);
    expect(otherTenantList.body.items).toEqual([]);
  });

  it('rejects unauthorized notes and archive fields atomically while allowing employee contact edits', async () => {
    const owner = await h.user();
    const employee = await h.user();
    const organization = await createOrganization(h, owner);
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });
    const created = await session(h, owner).create(organization.id, { name: 'Cliente', email: 'antes@example.test', notes: 'Privada' });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const employeeSession = session(h, employee);

    const employeeCreate = await employeeSession.create(organization.id, { name: 'Alta de empleado' });
    expect(employeeCreate.status).toBe(201);
    expect(employeeCreate.body).not.toHaveProperty('notes');
    expect((await employeeSession.create(organization.id, { name: 'Otra', notes: 'No permitida' })).status).toBe(403);
    expect((await employeeSession.create(organization.id, { name: 'Otra', active: false })).status).toBe(400);
    expect((await employeeSession.create(organization.id, { name: 'Email inválido', email: 'no-es-email' })).status).toBe(400);
    expect((await employeeSession.create(organization.id, { name: 'Teléfono corto', phone: '1234' })).status).toBe(400);

    const mixedPatch = await employeeSession.patch(organization.id, id, { name: 'Cambio parcial', active: false }, '"1"');
    expect(mixedPatch.status).toBe(403);
    const afterDeniedPatch = await session(h, owner).read(`${organization.id}/customers/${id}`);
    expect(afterDeniedPatch.body).toMatchObject({ name: 'Cliente', active: true, email: 'antes@example.test', notes: 'Privada', version: 1 });

    const update = await employeeSession.patch(organization.id, id, { name: 'Cliente actualizado', phone: null }, '"1"');
    expect(update.status).toBe(200);
    expect(update.headers.etag).toBe('"2"');
    expect(update.body).toMatchObject({ name: 'Cliente actualizado', phone: null, email: 'antes@example.test', version: 2 });
    expect(update.body).not.toHaveProperty('notes');
  });

  it('enforces quoted version preconditions and detects stale customer edits', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const ownerSession = session(h, owner);
    const created = await ownerSession.create(organization.id, { name: 'Versión' });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    expect((await ownerSession.patch(organization.id, id, { name: 'Sin precondición' })).status).toBe(428);
    expect((await ownerSession.patch(organization.id, id, { name: 'Formato inválido' }, '1')).status).toBe(400);
    const first = await ownerSession.patch(organization.id, id, { name: 'Versión dos' }, '"1"');
    expect(first.status).toBe(200);
    expect(first.headers.etag).toBe('"2"');
    const stale = await ownerSession.patch(organization.id, id, { name: 'No sobrescribir' }, '"1"');
    expect(stale.status).toBe(412);
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await ownerSession.read(`${organization.id}/customers/${id}`)).body.name).toBe('Versión dos');

    const concurrent = await ownerSession.create(organization.id, { name: 'Edición concurrente' });
    const results = await Promise.all([
      ownerSession.patch(organization.id, concurrent.body.id, { name: 'Cambio A' }, '"1"'),
      ownerSession.patch(organization.id, concurrent.body.id, { name: 'Cambio B' }, '"1"'),
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200, 412]);
    expect((await ownerSession.read(`${organization.id}/customers/${concurrent.body.id}`)).body.version).toBe(2);
  });

  it('normalizes duplicate candidates per tenant and keeps wildcard characters literal in search', async () => {
    const owner = await h.user();
    const otherOwner = await h.user();
    const organization = await createOrganization(h, owner);
    const otherOrganization = await createOrganization(h, otherOwner);
    const ownerSession = session(h, owner);
    const otherSession = session(h, otherOwner);
    const sharedEmail = 'shared+family@example.test';

    const first = await ownerSession.create(organization.id, { name: 'Porcentaje % literal', email: sharedEmail, phone: '+54 (11) 4444-5555' });
    expect(first.status).toBe(201);
    const inactive = await ownerSession.patch(organization.id, first.body.id, { active: false }, '"1"');
    expect(inactive.status).toBe(200);
    const secondTenant = await otherSession.create(otherOrganization.id, { name: 'Otra ficha', email: sharedEmail, phone: '+54 (11) 4444-5555' });
    expect(secondTenant.status).toBe(201);

    const secondRecord = await ownerSession.create(organization.id, { name: 'Segundo cliente', email: sharedEmail, phone: '+54 (11) 4444-5555' });
    expect(secondRecord.status).toBe(201);
    const candidates = await ownerSession.read(`${organization.id}/customers/duplicate-candidates?email=SHARED%2BFAMILY%40EXAMPLE.TEST`);
    expect(candidates.status).toBe(200);
    expect(candidates.body.items.map((item: { id: string }) => item.id).sort()).toEqual([first.body.id, secondRecord.body.id].sort());
    expect(candidates.body.items).toContainEqual(expect.objectContaining({ id: first.body.id, active: false }));
    expect(candidates.body.items[0]).not.toHaveProperty('notes');
    const excluded = await ownerSession.read(`${organization.id}/customers/duplicate-candidates?email=${encodeURIComponent(sharedEmail)}&excludeId=${first.body.id}`);
    expect(excluded.body.items.map((item: { id: string }) => item.id)).toEqual([secondRecord.body.id]);
    const phoneCandidates = await ownerSession.read(`${organization.id}/customers/duplicate-candidates?phone=${encodeURIComponent('+54 (11) 4444-5555')}`);
    expect(phoneCandidates.body.items.map((item: { id: string }) => item.id).sort()).toEqual([first.body.id, secondRecord.body.id].sort());
    expect((await ownerSession.read(`${organization.id}/customers/duplicate-candidates`)).status).toBe(400);

    const otherTenantCandidates = await otherSession.read(`${otherOrganization.id}/customers/duplicate-candidates?email=${encodeURIComponent(sharedEmail)}`);
    expect(otherTenantCandidates.body.items.map((item: { id: string }) => item.id)).toEqual([secondTenant.body.id]);

    const literalSearch = await ownerSession.read(`${organization.id}/customers?q=${encodeURIComponent('%')}&status=all`);
    expect(literalSearch.status).toBe(200);
    expect(literalSearch.body.items.map((item: { id: string }) => item.id)).toEqual([first.body.id]);
    const underscore = await ownerSession.create(organization.id, { name: 'Subrayado _ literal' });
    expect(underscore.status).toBe(201);
    const literalUnderscore = await ownerSession.read(`${organization.id}/customers?q=${encodeURIComponent('_')}&status=all`);
    expect(literalUnderscore.body.items.map((item: { id: string }) => item.id)).toEqual([underscore.body.id]);
    const page = await ownerSession.read(`${organization.id}/customers?status=all&limit=1&offset=0`);
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.pageInfo).toMatchObject({ limit: 1, offset: 0, hasMore: true, nextOffset: 1, windowLimitReached: false });

    await h.db.customer.createMany({ data: Array.from({ length: 11 }, (_, index) => ({
      organizationId: organization.id,
      name: `Coincidencia ${index}`,
      email: 'cap@example.test',
    })) });
    const capped = await ownerSession.read(`${organization.id}/customers/duplicate-candidates?email=cap%40example.test`);
    expect(capped.status).toBe(200);
    expect(capped.body.items).toHaveLength(10);
    expect(capped.body.hasMore).toBe(true);
  });

  it('enforces CSRF on writes and the commercial subscription gate on customer routes', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const ownerSession = session(h, owner);
    const withoutCsrf = await ownerSession.createWithoutCsrf(organization.id, { name: 'Sin CSRF' });
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body).toMatchObject({ code: 'CSRF_INVALID' });

    const trialEndsAt = new Date(h.clock.now().getTime() - 1);
    const trialStartedAt = new Date(trialEndsAt.getTime() - 336 * 60 * 60 * 1000);
    await h.db.subscription.update({
      where: { organizationId: organization.id },
      data: { status: 'EXPIRED', trialStartedAt, trialEndsAt },
    });
    const read = await ownerSession.read(`${organization.id}/customers`);
    expect(read.status).toBe(403);
    expect(read.body).toMatchObject({ code: 'SUBSCRIPTION_REQUIRED' });
    const write = await ownerSession.create(organization.id, { name: 'Suscripción vencida' });
    expect(write.status).toBe(403);
    expect(write.body).toMatchObject({ code: 'SUBSCRIPTION_REQUIRED' });
    expect(await h.db.customer.count({ where: { organizationId: organization.id } })).toBe(0);
  });
});
