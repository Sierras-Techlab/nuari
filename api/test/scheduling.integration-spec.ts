import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApiHarness, type ApiHarness } from './harness.js';
import { CsrfService } from '../src/common/csrf.js';
import { SecurityConfig } from '../src/common/security.config.js';

type TestUser = Awaited<ReturnType<ApiHarness['user']>>;

function schedulingSession(h: ApiHarness, user: TestUser) {
  const config = h.app.get(SecurityConfig);
  const csrf = h.app.get(CsrfService).issue(user.token);
  const client = request(h.app.getHttpServer());
  const send = (method: 'get' | 'patch' | 'post' | 'put', path: string, body?: unknown, etag?: string) => {
    const req = client[method](`/api/organizations/${path}`)
      .set('Cookie', `${config.sessionCookie}=${user.token}; ${config.csrfCookie}=${csrf}`);
    if (method !== 'get') req.set('Origin', config.webOrigin).set('X-CSRF-Token', csrf);
    if (etag !== undefined) req.set('If-Match', etag);
    return body === undefined ? req : req.send(body as object | string);
  };
  return { send };
}

async function createOrganization(h: ApiHarness, owner: TestUser) {
  const result = await h.organizations.createInitial(owner.principal, randomUUID(), {
    name: 'Scheduling test', slug: `scheduling-${randomUUID().slice(0, 12)}`,
    businessType: 'SERVICES', planCode: 'BASIC',
  });
  h.ownedOrganizations.add(result.organization.id);
  return result.organization;
}

describe('scheduling configuration against isolated PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness(); });
  afterAll(async () => { await h?.close(); });

  it('enforces tenant roles, strict policy validation, versions, and timezone impact checks', async () => {
    const owner = await h.user();
    const employee = await h.user();
    const otherOwner = await h.user();
    const organization = await createOrganization(h, owner);
    const otherOrganization = await createOrganization(h, otherOwner);
    await h.db.organizationMember.create({ data: { userId: employee.id, organizationId: organization.id, role: 'EMPLOYEE', status: 'ACTIVE' } });

    const ownerApi = schedulingSession(h, owner);
    const employeeApi = schedulingSession(h, employee);
    const settingsPath = `${organization.id}/scheduling/settings`;
    const initial = await ownerApi.send('get', settingsPath);
    expect(initial.status).toBe(200);
    expect(initial.headers.etag).toBe('"1"');
    expect(initial.body).toMatchObject({ slotStepMinutes: 15, publicMinNoticeMinutes: 120, publicMaxAdvanceDays: 60, publicCancelNoticeMinutes: 120, version: 1 });
    expect((await employeeApi.send('get', settingsPath)).status).toBe(200);

    for (const invalid of [
      { slotStepMinutes: 20 }, { publicMinNoticeMinutes: -1 }, { publicMinNoticeMinutes: '120' },
      { publicMaxAdvanceDays: null }, { publicMaxAdvanceDays: 366 },
      { publicMinNoticeMinutes: 0, publicMaxAdvanceDays: 366 },
    ]) {
      expect((await ownerApi.send('patch', settingsPath, invalid, '"1"')).status).toBe(400);
    }
    expect((await ownerApi.send('patch', settingsPath, { publicMaxAdvanceDays: 365 }, '"1"')).status).toBe(200);
    expect((await ownerApi.send('patch', settingsPath, { publicMaxAdvanceDays: 2 }, '"1"')).status).toBe(412);
    expect((await employeeApi.send('patch', settingsPath, { publicMaxAdvanceDays: 2 }, '"2"')).status).toBe(403);
    expect((await ownerApi.send('get', settingsPath)).body).toMatchObject({ publicMaxAdvanceDays: 365, version: 2 });

    const calendarsPath = `${organization.id}/scheduling/calendars`;
    const listed = await ownerApi.send('get', calendarsPath);
    expect(listed.status).toBe(200);
    const businessCalendar = listed.body.find((calendar: { kind: string }) => calendar.kind === 'BUSINESS');
    expect(businessCalendar).toMatchObject({ kind: 'BUSINESS', version: 1, weeklyWindows: [], dayOverrides: [] });
    expect((await employeeApi.send('get', calendarsPath)).status).toBe(200);

    const timeOff = await ownerApi.send('post', `${organization.id}/scheduling/calendars/${businessCalendar.id}/time-off`, {
      startAt: '2026-10-16T12:00:00Z', endAt: '2026-10-16T13:00:00Z', reasonCode: 'BUSINESS_CLOSED',
    }, '"1"');
    expect(timeOff.status).toBe(201);
    const refreshedCalendars = await ownerApi.send('get', calendarsPath);
    expect(refreshedCalendars.body.find((calendar: { id: string }) => calendar.id === businessCalendar.id).timeOff).toEqual([
      expect.objectContaining({ id: timeOff.body.id, startAt: '2026-10-16T12:00:00.000Z', endAt: '2026-10-16T13:00:00.000Z', reasonCode: 'BUSINESS_CLOSED' }),
    ]);
    expect((await schedulingSession(h, otherOwner).send('get', calendarsPath)).status).toBe(404);

    const weeklyPath = `${organization.id}/scheduling/calendars/${businessCalendar.id}/weekly-windows`;
    const weekly = await ownerApi.send('put', weeklyPath, {
      windows: [
        { weekday: 1, startMinute: 540, endMinute: 780 },
        { weekday: 1, startMinute: 900, endMinute: 1140 },
      ],
    }, '"2"');
    expect(weekly.status).toBe(200);
    expect(weekly.headers.etag).toBe('"3"');
    expect((await ownerApi.send('put', weeklyPath, { windows: [] }, '"1"')).status).toBe(412);
    expect((await employeeApi.send('put', weeklyPath, { windows: [] }, '"3"')).status).toBe(403);
    expect((await ownerApi.send('put', weeklyPath, {
      windows: [
        { weekday: 1, startMinute: 540, endMinute: 780 },
        { weekday: 1, startMinute: 700, endMinute: 900 },
      ],
    }, '"3"')).status).toBe(400);

    const directTimezoneChange = await ownerApi.send('patch', `${organization.id}`, { timezone: 'America/Argentina/Cordoba' });
    expect(directTimezoneChange.status).toBe(409);
    expect(directTimezoneChange.body).toMatchObject({ code: 'TIMEZONE_CHANGE_BLOCKED' });
    const countryTimezoneChange = await ownerApi.send('patch', `${organization.id}`, { country: 'UY', confirmCurrencyChange: true });
    expect(countryTimezoneChange.status).toBe(409);
    expect(countryTimezoneChange.body).toMatchObject({ code: 'TIMEZONE_CHANGE_BLOCKED' });
    expect((await ownerApi.send('get', `${organization.id}`)).body.organization.timezone).toBe('America/Argentina/Buenos_Aires');

    const crossTenantPath = `${otherOrganization.id}/scheduling/calendars/${businessCalendar.id}/weekly-windows`;
    expect((await schedulingSession(h, otherOwner).send('put', crossTenantPath, { windows: [] }, '"2"')).status).toBe(404);
  });
});
