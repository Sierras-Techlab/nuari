import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiHarness, MutableClock, type ApiHarness } from './harness.js';
import { CsrfService } from '../src/common/csrf.js';
import { SecurityConfig } from '../src/common/security.config.js';

type TestUser = Awaited<ReturnType<ApiHarness['user']>>;

function clientFor(h: ApiHarness, user: TestUser) {
  const config = h.app.get(SecurityConfig);
  const csrf = h.app.get(CsrfService).issue(user.token);
  const server = h.app.getHttpServer();
  const cookie = `${config.sessionCookie}=${user.token}; ${config.csrfCookie}=${csrf}`;
  return {
    post: (path: string) => request(server).post(`/api/organizations${path}`)
      .set('Cookie', cookie).set('Origin', config.webOrigin).set('X-CSRF-Token', csrf),
    get: (path: string) => request(server).get(`/api/organizations${path}`).set('Cookie', cookie),
  };
}

async function createOrganization(h: ApiHarness, owner: TestUser) {
  const result = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: 'Appointments test', slug: `appointments-${randomUUID().slice(0, 12)}`,
    businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(result.organization.id);
  return result.organization;
}

describe('internal appointments against isolated PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => {
    h = await createApiHarness({ clock: new MutableClock(new Date('2027-05-14T00:00:00.000Z')) });
  });
  afterAll(async () => { await h?.close(); });

  it('creates atomically, replays by idempotency key, and rejects a conflicting booking', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const service = await h.db.service.create({ data: {
      organizationId: organization.id, name: 'Corte', nameKey: `corte-${randomUUID().slice(0, 8)}`,
      durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'CUSTOMER_CHOICE',
    } });
    const customer = await h.db.customer.create({ data: { organizationId: organization.id, name: 'Alex Cliente' } });
    const staff = await h.db.staffMember.create({ data: { organizationId: organization.id, name: 'Juan' } });
    await h.db.staffService.create({ data: { organizationId: organization.id, staffMemberId: staff.id, serviceId: service.id } });
    const staffCalendar = await h.db.bookingCalendar.create({ data: { organizationId: organization.id, kind: 'STAFF', staffMemberId: staff.id } });
    await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: staffCalendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });
    const businessCalendar = await h.db.bookingCalendar.findFirstOrThrow({ where: { organizationId: organization.id, kind: 'BUSINESS' } });
    await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: businessCalendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });

    const path = `/${organization.id}/appointments`;
    const key = randomUUID();
    const body = {
      customerId: customer.id, serviceId: service.id, startAt: '2027-05-14T16:00:00-03:00',
      assignment: { kind: 'SPECIFIC', staffMemberId: staff.id },
    };
    const created = await clientFor(h, owner).post(path).set('Idempotency-Key', key).send(body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: 'CONFIRMED', assignmentKind: 'SPECIFIC', staffMemberId: staff.id, customerId: customer.id });
    expect(created.body).not.toHaveProperty('customerPhoneSnapshot');
    expect(created.body).not.toHaveProperty('customerEmailSnapshot');
    expect(created.body).not.toHaveProperty('internalNotes');

    const replay = await clientFor(h, owner).post(path).set('Idempotency-Key', key).send(body);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(created.body.id);

    const reused = await clientFor(h, owner).post(path).set('Idempotency-Key', key).send({ ...body, startAt: '2027-05-14T16:30:00-03:00' });
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const conflict = await clientFor(h, owner).post(path).set('Idempotency-Key', randomUUID()).send(body);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('SLOT_UNAVAILABLE');

    const employee = await h.user();
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });
    const notesForbidden = await clientFor(h, employee).post(path).set('Idempotency-Key', randomUUID()).send({
      ...body, startAt: '2027-05-14T18:00:00-03:00', internalNotes: 'dato sensible',
    });
    expect(notesForbidden.status).toBe(403);
    expect(notesForbidden.body.code).toBe('PERMISSION_DENIED');

    const concurrentBody = { ...body, startAt: '2027-05-14T17:00:00-03:00' };
    const concurrent = await Promise.all([
      clientFor(h, owner).post(path).set('Idempotency-Key', randomUUID()).send(concurrentBody),
      clientFor(h, owner).post(path).set('Idempotency-Key', randomUUID()).send(concurrentBody),
    ]);
    expect(concurrent.map(result => result.status).sort()).toEqual([201, 409]);
    expect(concurrent.filter(result => result.status === 409).map(result => result.body.code)).toEqual(['SLOT_UNAVAILABLE']);

    const replayKey = randomUUID();
    const replayBody = { ...body, startAt: '2027-05-14T17:30:00-03:00' };
    const sameSubmission = await Promise.all([
      clientFor(h, owner).post(path).set('Idempotency-Key', replayKey).send(replayBody),
      clientFor(h, owner).post(path).set('Idempotency-Key', replayKey).send(replayBody),
    ]);
    expect(sameSubmission.map(result => result.status)).toEqual([201, 201]);
    expect(sameSubmission[0]!.body.id).toBe(sameSubmission[1]!.body.id);
    expect(await h.db.appointment.count({ where: { organizationId: organization.id } })).toBe(3);
    expect(await h.db.appointmentEvent.count({ where: { organizationId: organization.id } })).toBe(3);
    expect(await h.db.bookingSubmission.count({ where: { organizationId: organization.id } })).toBe(3);
  });

  it('assigns ANY to the available professional with the lowest local-day booking count', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const service = await h.db.service.create({ data: {
      organizationId: organization.id, name: 'Corte balance', nameKey: `corte-${randomUUID().slice(0, 8)}`,
      durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'CUSTOMER_CHOICE',
    } });
    const customer = await h.db.customer.create({ data: { organizationId: organization.id, name: 'Cliente Balance' } });
    const staff = [] as Array<{ id: string; name: string }>;
    for (const name of ['Alicia', 'Beatriz']) {
      const member = await h.db.staffMember.create({ data: { organizationId: organization.id, name } });
      staff.push(member);
      await h.db.staffService.create({ data: { organizationId: organization.id, staffMemberId: member.id, serviceId: service.id } });
      const calendar = await h.db.bookingCalendar.create({ data: { organizationId: organization.id, kind: 'STAFF', staffMemberId: member.id } });
      await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: calendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });
    }
    const businessCalendar = await h.db.bookingCalendar.findFirstOrThrow({ where: { organizationId: organization.id, kind: 'BUSINESS' } });
    await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: businessCalendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });
    const membership = await h.db.organizationMember.findFirstOrThrow({ where: { organizationId: organization.id, userId: owner.id, status: 'ACTIVE' } });
    for (let index = 0; index < 2; index += 1) {
      await h.db.appointment.create({ data: {
        organizationId: organization.id, customerId: customer.id, serviceId: service.id, staffMemberId: staff[0]!.id,
        startAt: new Date(`2027-05-14T${index === 0 ? '12:00' : '13:00'}:00.000Z`),
        endAt: new Date(`2027-05-14T${index === 0 ? '12:30' : '13:30'}:00.000Z`), durationMinutes: 30,
        schedulingPolicyVersion: 1, slotStepMinutesSnapshot: 15, publicMinNoticeMinutesSnapshot: 120,
        publicMaxAdvanceDaysSnapshot: 60, publicCancelNoticeMinutesSnapshot: 120,
        timezoneSnapshot: 'America/Argentina/Buenos_Aires', serviceSelectionModeSnapshot: 'CUSTOMER_CHOICE',
        assignmentKind: 'SPECIFIC', customerNameSnapshot: customer.name, serviceNameSnapshot: service.name,
        staffNameSnapshot: staff[0]!.name, status: 'COMPLETED', source: 'MEMBER', createdByMembershipId: membership.id,
      } });
    }

    const result = await clientFor(h, owner).post(`/${organization.id}/appointments`)
      .set('Idempotency-Key', randomUUID()).send({
        customerId: customer.id, serviceId: service.id, startAt: '2027-05-14T16:00:00-03:00', assignment: { kind: 'ANY' },
      });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    expect(result.body).toMatchObject({ assignmentKind: 'ANY', staffMemberId: staff[1]!.id, staffNameSnapshot: 'Beatriz' });
  });

  it('lists, cancels with a version precondition, records history, and refuses an occupied correction', async () => {
    const owner = await h.user();
    const organization = await createOrganization(h, owner);
    const service = await h.db.service.create({ data: {
      organizationId: organization.id, name: 'Corte historial', nameKey: `corte-${randomUUID().slice(0, 8)}`,
      durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'CUSTOMER_CHOICE',
    } });
    const customer = await h.db.customer.create({ data: { organizationId: organization.id, name: 'Cliente Historial' } });
    const staff = await h.db.staffMember.create({ data: { organizationId: organization.id, name: 'Sol' } });
    await h.db.staffService.create({ data: { organizationId: organization.id, staffMemberId: staff.id, serviceId: service.id } });
    const staffCalendar = await h.db.bookingCalendar.create({ data: { organizationId: organization.id, kind: 'STAFF', staffMemberId: staff.id } });
    await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: staffCalendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });
    const businessCalendar = await h.db.bookingCalendar.findFirstOrThrow({ where: { organizationId: organization.id, kind: 'BUSINESS' } });
    await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: businessCalendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });
    const client = clientFor(h, owner);
    const path = `/${organization.id}/appointments`;
    const body = { customerId: customer.id, serviceId: service.id, startAt: '2027-05-14T16:00:00-03:00', assignment: { kind: 'SPECIFIC', staffMemberId: staff.id } };
    const created = await client.post(path).set('Idempotency-Key', randomUUID()).send(body);
    expect(created.status).toBe(201);

    const list = await client.get(path).query({ fromDate: '2027-05-14', toDate: '2027-05-15', status: 'CONFIRMED' });
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const detail = await client.get(`${path}/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.headers.etag).toBe('"1"');

    const cancelled = await client.post(`${path}/${created.body.id}/cancel`).set('If-Match', '"1"').send({ reasonCode: 'CUSTOMER_REQUEST' });
    expect(cancelled.status).toBe(201);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', version: 2 });
    const events = await client.get(`${path}/${created.body.id}/events`);
    expect(events.status).toBe(200);
    expect(events.body.map((item: { action: string }) => item.action)).toEqual(['CREATED', 'CANCELLED']);

    const replacement = await client.post(path).set('Idempotency-Key', randomUUID()).send(body);
    expect(replacement.status).toBe(201);
    const rescheduled = await client.post(`${path}/${replacement.body.id}/reschedule`).set('If-Match', '"1"').send({
      startAt: '2027-05-14T17:00:00-03:00', assignment: { kind: 'SPECIFIC', staffMemberId: staff.id },
    });
    expect(rescheduled.status, JSON.stringify(rescheduled.body)).toBe(201);
    expect(rescheduled.body).toMatchObject({ status: 'CONFIRMED', version: 2, startAt: '2027-05-14T20:00:00.000Z', staffMemberId: staff.id });
    const stale = await client.post(`${path}/${replacement.body.id}/reschedule`).set('If-Match', '"1"').send({
      startAt: '2027-05-14T17:30:00-03:00', assignment: { kind: 'SPECIFIC', staffMemberId: staff.id },
    });
    expect(stale.status).toBe(412);
    const blocker = await client.post(path).set('Idempotency-Key', randomUUID()).send(body);
    expect(blocker.status).toBe(201);
    const correction = await client.post(`${path}/${created.body.id}/correct`).set('If-Match', '"2"').send({ status: 'CONFIRMED', reasonCode: 'DATA_ENTRY_ERROR' });
    expect(correction.status).toBe(409);
    expect(correction.body.code).toBe('SLOT_UNAVAILABLE');
    expect((await client.get(`${path}/${created.body.id}`)).body.status).toBe('CANCELLED');
  });
});
