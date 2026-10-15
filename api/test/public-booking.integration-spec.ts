import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiHarness, MutableClock, type ApiHarness } from './harness.js';
import { CsrfService } from '../src/common/csrf.js';
import { SecurityConfig } from '../src/common/security.config.js';

type TestUser = Awaited<ReturnType<ApiHarness['user']>>;

function anonymous(h: ApiHarness) {
  const config = h.app.get(SecurityConfig);
  const csrf = h.app.get(CsrfService).issue();
  const server = h.app.getHttpServer();
  const cookie = `${config.csrfCookie}=${csrf}`;
  return {
    get: (path: string) => request(server).get(`/api${path}`),
    post: (path: string) => request(server).post(`/api${path}`).set('Cookie', cookie).set('Origin', config.webOrigin).set('X-CSRF-Token', csrf),
  };
}

function ownerClient(h: ApiHarness, user: TestUser) {
  const config = h.app.get(SecurityConfig);
  const csrf = h.app.get(CsrfService).issue(user.token);
  const cookie = `${config.sessionCookie}=${user.token}; ${config.csrfCookie}=${csrf}`;
  return (path: string) => request(h.app.getHttpServer()).post(`/api${path}`).set('Cookie', cookie).set('Origin', config.webOrigin).set('X-CSRF-Token', csrf);
}

async function fixture(h: ApiHarness) {
  const owner = await h.user();
  const created = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: 'Public booking test', slug: `public-${randomUUID().slice(0, 12)}`, businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(created.organization.id);
  const org = created.organization;
  const service = await h.db.service.create({ data: {
    organizationId: org.id, name: 'Consulta pública', nameKey: `consulta-${randomUUID().slice(0, 8)}`,
    durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'NO_ASSIGNMENT', publicBookable: true,
  } });
  await h.db.schedulingSettings.update({ where: { organizationId: org.id }, data: { publicBookingEnabled: true, publicMinNoticeMinutes: 120, publicMaxAdvanceDays: 60 } });
  const calendar = await h.db.bookingCalendar.findFirstOrThrow({ where: { organizationId: org.id, kind: 'BUSINESS' } });
  await h.db.calendarWeeklyWindow.create({ data: { organizationId: org.id, calendarId: calendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });
  return { owner, organization: org, service };
}

describe('public booking against isolated PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness({ clock: new MutableClock(new Date('2027-05-14T00:00:00.000Z')) }); });
  afterAll(async () => { await h?.close(); });

  it('creates a separate guest and hashed revocable link, replays idempotently, and cancels after unpublishing', async () => {
    const { owner, organization, service } = await fixture(h);
    const api = anonymous(h);
    const catalog = await api.get(`/public/booking/${organization.slug}/catalog`);
    expect(catalog.status, JSON.stringify(catalog.body)).toBe(200);
    expect(catalog.body.services).toHaveLength(1);
    expect(catalog.body.services[0]).not.toHaveProperty('staff');

    const body = {
      serviceId: service.id, startAt: '2027-05-14T16:00:00-03:00', assignment: { kind: 'NONE' },
      customer: { name: 'Visitante público', phone: '+54 11 5555-1111' },
    };
    const key = randomUUID();
    const path = `/public/booking/${organization.slug}/appointments`;
    const created = await api.post(path).set('Idempotency-Key', key).send(body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: 'CONFIRMED', serviceName: 'Consulta pública', timeZone: 'America/Argentina/Buenos_Aires' });
    expect(created.body.managementToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.body).not.toHaveProperty('organizationId');
    expect(created.body).not.toHaveProperty('customerId');

    const appointment = await h.db.appointment.findFirstOrThrow({ where: { id: created.body.id } });
    expect(appointment.source).toBe('PUBLIC');
    expect(appointment.managementTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(appointment.managementTokenHash).not.toBe(created.body.managementToken);
    expect(appointment.managementTokenExpiresAt?.toISOString()).toBe('2027-06-13T19:30:00.000Z');
    expect(await h.db.customer.count({ where: { organizationId: organization.id, phoneNormalized: '+541155551111' } })).toBe(1);

    const replay = await api.post(path).set('Idempotency-Key', key).send(body);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(created.body.id);
    expect(replay.body.managementToken).toBe(created.body.managementToken);
    const reused = await api.post(path).set('Idempotency-Key', key).send({ ...body, customer: { name: 'Otro nombre', phone: body.customer.phone } });
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const token = created.body.managementToken as string;
    const resolvePath = `/public/booking/${organization.slug}/manage/resolve`;
    const resolved = await api.post(resolvePath).send({ token });
    expect(resolved.status).toBe(201);
    expect(resolved.body).toMatchObject({ id: created.body.id, status: 'CONFIRMED', actions: { canCancel: true, canReschedule: true } });

    await h.db.schedulingSettings.update({ where: { organizationId: organization.id }, data: { publicBookingEnabled: false } });
    const unavailable = await api.get(`/public/booking/${organization.slug}/catalog`);
    expect(unavailable.status).toBe(404);
    expect(unavailable.body.code).toBe('BOOKING_NOT_AVAILABLE');
    const cancelled = await api.post(`/public/booking/${organization.slug}/manage/${created.body.id}/cancel`)
      .set('If-Match', '"1"').send({ token, reasonCode: 'CUSTOMER_REQUEST' });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(201);
    expect(cancelled.body.status).toBe('CANCELLED');

    const second = await api.post(path).set('Idempotency-Key', randomUUID()).send({ ...body, startAt: '2027-05-14T17:00:00-03:00', customer: { name: 'Otro visitante', email: 'otro@example.test' } });
    expect(second.status).toBe(404);
    expect(second.body.code).toBe('BOOKING_NOT_AVAILABLE');
    expect(await h.db.appointmentEvent.count({ where: { organizationId: organization.id, appointmentId: created.body.id } })).toBe(2);
    expect(owner.id).toBeTruthy();
  });

  it('revokes one public management link without changing the appointment status', async () => {
    const { owner, organization, service } = await fixture(h);
    const api = anonymous(h);
    const created = await api.post(`/public/booking/${organization.slug}/appointments`).set('Idempotency-Key', randomUUID()).send({
      serviceId: service.id, startAt: '2027-05-14T16:00:00-03:00', assignment: { kind: 'NONE' }, customer: { name: 'Revoque', email: 'revoque@example.test' },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const revoked = await ownerClient(h, owner)(`/organizations/${organization.id}/appointments/${created.body.id}/management-link/revoke`)
      .set('If-Match', '"1"').send({ reasonCode: 'SECURITY_CONCERN' });
    expect(revoked.status, JSON.stringify(revoked.body)).toBe(201);
    expect(revoked.body).toMatchObject({ status: 'CONFIRMED', version: 2, managementLinkActive: false });
    const resolve = await api.post(`/public/booking/${organization.slug}/manage/resolve`).send({ token: created.body.managementToken });
    expect(resolve.status).toBe(404);
    expect(await h.db.appointment.findFirstOrThrow({ where: { id: created.body.id } }).then(row => row.status)).toBe('CONFIRMED');
    expect(await h.db.appointmentEvent.count({ where: { organizationId: organization.id, appointmentId: created.body.id, action: 'MANAGEMENT_LINK_REVOKED' } })).toBe(1);
  });

  it('uses public availability policy and revalidates a management reschedule transactionally', async () => {
    const { organization, service } = await fixture(h);
    const api = anonymous(h);
    const availability = await api.get(`/public/booking/${organization.slug}/availability`).query({
      serviceId: service.id, selection: 'NONE', fromDate: '2027-05-14', toDate: '2027-05-15',
    });
    expect(availability.status, JSON.stringify(availability.body)).toBe(200);
    expect(availability.body.slots.length).toBeGreaterThan(0);
    expect(availability.body.slots[0].staff).toEqual([]);

    const created = await api.post(`/public/booking/${organization.slug}/appointments`).set('Idempotency-Key', randomUUID()).send({
      serviceId: service.id, startAt: '2027-05-14T16:00:00-03:00', assignment: { kind: 'NONE' }, customer: { name: 'Reprogramación', email: 'reagenda@example.test' },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const rescheduled = await api.post(`/public/booking/${organization.slug}/manage/${created.body.id}/reschedule`)
      .set('If-Match', '"1"').send({ token: created.body.managementToken, startAt: '2027-05-14T16:30:00-03:00', assignment: { kind: 'NONE' } });
    expect(rescheduled.status, JSON.stringify(rescheduled.body)).toBe(201);
    expect(rescheduled.body).toMatchObject({ id: created.body.id, version: 2, startAt: '2027-05-14T19:30:00.000Z' });
    const appointment = await h.db.appointment.findFirstOrThrow({ where: { id: created.body.id } });
    expect(appointment.managementTokenExpiresAt?.toISOString()).toBe('2027-06-13T20:00:00.000Z');
    expect(await h.db.appointmentEvent.findFirstOrThrow({ where: { appointmentId: created.body.id, action: 'RESCHEDULED' } })).toMatchObject({ actorType: 'PUBLIC', actorMembershipId: null });
    const resolved = await api.post(`/public/booking/${organization.slug}/manage/resolve`).send({ token: created.body.managementToken });
    expect(resolved.body).toMatchObject({ startAt: '2027-05-14T19:30:00.000Z', actions: { canReschedule: true } });

    await h.db.schedulingSettings.update({ where: { organizationId: organization.id }, data: { publicBookingEnabled: false } });
    const blocked = await api.post(`/public/booking/${organization.slug}/manage/${created.body.id}/reschedule`)
      .set('If-Match', '"2"').send({ token: created.body.managementToken, startAt: '2027-05-14T17:00:00-03:00', assignment: { kind: 'NONE' } });
    expect(blocked.status).toBe(404);
    expect(blocked.body.code).toBe('BOOKING_NOT_AVAILABLE');
    expect((await h.db.appointment.findFirstOrThrow({ where: { id: created.body.id } })).version).toBe(2);
  });
});
