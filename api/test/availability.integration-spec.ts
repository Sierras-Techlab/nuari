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
  return { get: (path: string) => request(server).get(`/api/organizations${path}`).set('Cookie', cookie) };
}

async function createOrganization(h: ApiHarness, owner: TestUser) {
  const result = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: 'Availability test', slug: `availability-${randomUUID().slice(0, 12)}`,
    businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(result.organization.id);
  return result.organization;
}

describe('private availability against isolated PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => {
    h = await createApiHarness({ clock: new MutableClock(new Date('2027-05-14T00:00:00.000Z')) });
  });
  afterAll(async () => { await h?.close(); });

  it('returns tenant-scoped local slots and candidates using calendar, service, and staff projections', async () => {
    const owner = await h.user();
    const employee = await h.user();
    const organization = await createOrganization(h, owner);
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });
    const service = await h.db.service.create({ data: {
      organizationId: organization.id, name: 'Corte', nameKey: `corte-${randomUUID().slice(0, 8)}`,
      durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'CUSTOMER_CHOICE',
    } });

    const staffIds: string[] = [];
    for (const name of ['Juan', 'Pedro']) {
      const staff = await h.db.staffMember.create({ data: { organizationId: organization.id, name } });
      staffIds.push(staff.id);
      await h.db.staffService.create({ data: { organizationId: organization.id, staffMemberId: staff.id, serviceId: service.id } });
      const calendar = await h.db.bookingCalendar.create({ data: { organizationId: organization.id, kind: 'STAFF', staffMemberId: staff.id } });
      await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: calendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });
    }
    const businessCalendar = await h.db.bookingCalendar.findFirstOrThrow({ where: { organizationId: organization.id, kind: 'BUSINESS' } });
    await h.db.calendarWeeklyWindow.create({ data: { organizationId: organization.id, calendarId: businessCalendar.id, weekday: 5, startMinute: 540, endMinute: 1140 } });

    const path = `/${organization.id}/availability`;
    const any = await clientFor(h, owner).get(path).query({
      serviceId: service.id, fromDate: '2027-05-14', toDate: '2027-05-15', selection: 'ANY',
    });
    expect(any.status).toBe(200);
    expect(any.headers['cache-control']).toContain('no-store');
    const atFour = any.body.slots.find((slot: { localTime: string }) => slot.localTime === '16:00');
    expect(atFour).toMatchObject({ startAt: '2027-05-14T19:00:00.000Z', endAt: '2027-05-14T19:30:00.000Z', offset: '-03:00' });
    expect(atFour.staff.map((item: { id: string }) => item.id).sort()).toEqual([...staffIds].sort());

    const specific = await clientFor(h, owner).get(path).query({
      serviceId: service.id, fromDate: '2027-05-14', toDate: '2027-05-15', selection: 'SPECIFIC', staffMemberId: staffIds[0],
    });
    expect(specific.status).toBe(200);
    expect(specific.body.slots.find((slot: { localTime: string }) => slot.localTime === '16:00').staff).toEqual([
      expect.objectContaining({ id: staffIds[0] }),
    ]);
    const employeeResult = await clientFor(h, employee).get(path).query({
      serviceId: service.id, at: '2027-05-14T16:00:00-03:00', selection: 'ANY',
    });
    expect(employeeResult.status).toBe(200);
    expect(employeeResult.body.slots).toHaveLength(1);
    expect(employeeResult.body.slots[0].startAt).toBe('2027-05-14T19:00:00.000Z');
    expect((await clientFor(h, owner).get(path).query({
      serviceId: service.id, fromDate: '2027-05-14', toDate: '2027-05-23', selection: 'ANY',
    })).status).toBe(400);
    expect((await clientFor(h, owner).get(path).query({
      serviceId: service.id, fromDate: '2027-05-14', toDate: '2027-05-15', selection: 'NONE',
    })).status).toBe(400);
  });
});
