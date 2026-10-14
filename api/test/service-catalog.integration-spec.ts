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
    name: 'Service catalog test', slug: `catalog-${randomUUID().slice(0, 12)}`,
    businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(created.organization.id);
  return created.organization;
}

describe('service catalog API against authorized development PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness(); });
  afterAll(async () => { await h?.close(); });

  it('persists tenant-scoped categories and exact service prices with optimistic versions', async () => {
    const owner = await h.user();
    const otherOwner = await h.user();
    const organization = await createOrganization(h, owner);
    const otherOrganization = await createOrganization(h, otherOwner);
    const api = session(h, owner);
    const category = await api.write('post', `${organization.id}/service-categories`, { name: '  Cabello  ' });
    expect(category.status).toBe(201);
    expect(category.body).toMatchObject({ organizationId: organization.id, name: 'Cabello', active: true, version: 1, sortOrder: 0 });
    expect(category.headers.etag).toBe('"1"');
    expect((await api.write('post', `${organization.id}/service-categories`, { name: 'cabello' })).status).toBe(409);
    const foreignCategory = await session(h, otherOwner).write('post', `${otherOrganization.id}/service-categories`, { name: 'Otra' });
    expect(foreignCategory.status).toBe(201);
    const crossTenantService = await api.write('post', `${organization.id}/services`, {
      name: 'Categoría ajena', durationMinutes: 30, categoryId: foreignCategory.body.id,
      staffSelectionMode: 'NO_ASSIGNMENT',
    });
    expect(crossTenantService.status).toBe(404);

    const service = await api.write('post', `${organization.id}/services`, {
      name: 'Corte', durationMinutes: 40, pricingType: 'FIXED', price: '12500.00',
      categoryId: category.body.id, staffSelectionMode: 'CUSTOMER_CHOICE',
    });
    expect(service.status).toBe(201);
    expect(service.body).toMatchObject({ organizationId: organization.id, price: '12500.00', currency: 'ARS', categoryId: category.body.id, version: 1 });
    expect(service.headers.etag).toBe('"1"');
    expect((await api.write('post', `${organization.id}/services`, {
      name: 'cORTE', durationMinutes: 40, pricingType: 'FIXED', price: '1.00', staffSelectionMode: 'NO_ASSIGNMENT',
    })).status).toBe(409);
    expect((await api.write('patch', `${organization.id}/service-categories/${category.body.id}`, { active: false }, '"1"')).status).toBe(200);
    expect((await api.write('post', `${organization.id}/services`, {
      name: 'Categoría archivada', durationMinutes: 30, categoryId: category.body.id, staffSelectionMode: 'NO_ASSIGNMENT',
    })).status).toBe(409);
    const maximumPrice = await api.write('post', `${organization.id}/services`, {
      name: 'Precio máximo', durationMinutes: 5, pricingType: 'FROM', price: '9999999999.99', staffSelectionMode: 'NO_ASSIGNMENT',
    });
    expect(maximumPrice.status).toBe(201);
    expect(maximumPrice.body.price).toBe('9999999999.99');
    const maximumDuration = await api.write('post', `${organization.id}/services`, {
      name: 'Duración máxima', durationMinutes: 720, staffSelectionMode: 'NO_ASSIGNMENT',
    });
    expect(maximumDuration.status).toBe(201);

    const invalidPrices = await Promise.all([
      api.write('post', `${organization.id}/services`, { name: 'Número JSON', durationMinutes: 40, pricingType: 'FIXED', price: 12.5, staffSelectionMode: 'NO_ASSIGNMENT' }),
      api.write('post', `${organization.id}/services`, { name: 'Exponente', durationMinutes: 40, pricingType: 'FIXED', price: '1e3', staffSelectionMode: 'NO_ASSIGNMENT' }),
      api.write('post', `${organization.id}/services`, { name: 'Escala', durationMinutes: 40, pricingType: 'FIXED', price: '1.001', staffSelectionMode: 'NO_ASSIGNMENT' }),
      api.write('post', `${organization.id}/services`, { name: 'Duración', durationMinutes: 721, staffSelectionMode: 'NO_ASSIGNMENT' }),
    ]);
    expect(invalidPrices.map(result => result.status)).toEqual([400, 400, 400, 400]);

    const update = await api.write('patch', `${organization.id}/services/${service.body.id}`, { price: '0.00' }, '"1"');
    expect(update.status).toBe(200);
    expect(update.body.price).toBe('0.00');
    expect(update.headers.etag).toBe('"2"');
    expect((await api.write('patch', `${organization.id}/services/${service.body.id}`, { name: 'Stale' }, '"1"')).status).toBe(412);
    expect((await session(h, otherOwner).read(`${otherOrganization.id}/services/${service.body.id}`)).status).toBe(404);
  });

  it('requires currency confirmation with no prices and blocks any persisted price, including zero and inactive', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const api = session(h, owner);
    const create = await api.write('post', `${organization.id}/services`, {
      name: 'Consulta', durationMinutes: 30, pricingType: 'ON_REQUEST', staffSelectionMode: 'NO_ASSIGNMENT',
    });
    expect(create.status).toBe(201);

    const settingsPath = `${organization.id}`;
    expect((await api.write('patch', settingsPath, { country: 'UY' })).body).toMatchObject({ code: 'VALIDATION_ERROR' });
    const switched = await api.write('patch', settingsPath, { country: 'UY', confirmCurrencyChange: true });
    expect(switched.status).toBe(200);
    expect(switched.body.organization).toMatchObject({ country: 'UY', currency: 'UYU' });
    const noPriceService = await api.read(`${organization.id}/services/${create.body.id}`);
    expect(noPriceService.body).toMatchObject({ price: null, currency: 'UYU', version: 2 });

    const priced = await api.write('post', `${organization.id}/services`, {
      name: 'Gratis', durationMinutes: 30, pricingType: 'FIXED', price: '0.00', staffSelectionMode: 'NO_ASSIGNMENT',
    });
    expect(priced.status).toBe(201);
    const archived = await api.write('patch', `${organization.id}/services/${priced.body.id}`, { active: false }, '"1"');
    expect(archived.status, JSON.stringify(archived.body)).toBe(200);
    const blocked = await api.write('patch', settingsPath, { country: 'CL', confirmCurrencyChange: true });
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: 'CURRENCY_CHANGE_REQUIRES_MIGRATION' });
    expect((await api.read(`${organization.id}/services/${priced.body.id}`)).body).toMatchObject({ price: '0.00', currency: 'UYU', active: false });
  });

  it('serializes a first priced service against a concurrent regional currency change', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const api = session(h, owner);
    const [created, settings] = await Promise.all([
      api.write('post', `${organization.id}/services`, {
        name: 'Primer precio', durationMinutes: 30, pricingType: 'FIXED', price: '1.00',
        staffSelectionMode: 'NO_ASSIGNMENT',
      }),
      api.write('patch', organization.id, { country: 'UY', confirmCurrencyChange: true }),
    ]);
    expect(created.status).toBe(201);
    const persistedOrganization = await h.db.organization.findUniqueOrThrow({ where: { id: organization.id } });
    if (settings.status === 200) {
      expect(persistedOrganization.currency).toBe('UYU');
      expect(created.body.currency).toBe('UYU');
    } else {
      expect(settings.status).toBe(409);
      expect(settings.body).toMatchObject({ code: 'CURRENCY_CHANGE_REQUIRES_MIGRATION' });
      expect(persistedOrganization.currency).toBe('ARS');
      expect(created.body.currency).toBe('ARS');
    }
  });
});
