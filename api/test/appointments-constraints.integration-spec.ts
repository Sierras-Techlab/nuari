import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApiHarness, type ApiHarness } from './harness.js';

describe('appointment database constraints on isolated PostgreSQL', () => {
  let h: ApiHarness;
  beforeAll(async () => { h = await createApiHarness(); });
  afterAll(async () => { await h?.close(); });

  it('enforces half-open appointment conflicts, terminal occupancy, NONE capacity, and tenant relations', async () => {
    const owner = await h.user();
    const created = await h.organizations.createInitial(owner.principal, randomUUID(), {
      name: 'Appointment constraints test', slug: `appointment-${randomUUID().slice(0, 12)}`, businessType: 'SERVICES', planCode: 'BASIC',
    });
    const organizationId = created.organization.id;
    h.ownedOrganizations.add(organizationId);
    const membership = await h.db.organizationMember.findUniqueOrThrow({ where: { userId_organizationId: { userId: owner.id, organizationId } } });
    const customer = await h.db.customer.create({ data: { organizationId, name: 'Test customer' } });
    const staff = await h.db.staffMember.create({ data: { organizationId, name: 'Test staff' } });
    const service = await h.db.service.create({ data: {
      organizationId, name: 'Staff service', nameKey: 'staff service', durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'CUSTOMER_CHOICE',
    } });
    const noAssignmentService = await h.db.service.create({ data: {
      organizationId, name: 'Unassigned service', nameKey: 'unassigned service', durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'NO_ASSIGNMENT',
    } });

    async function insertAppointment(options: { start: string; serviceId?: string; staffMemberId?: string | null; status?: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' }) {
      const startAt = new Date(options.start);
      const endAt = new Date(startAt.getTime() + 30 * 60_000);
      const unassigned = options.serviceId === noAssignmentService.id;
      return h.db.appointment.create({ data: {
        organizationId, customerId: customer.id, serviceId: options.serviceId ?? service.id,
        staffMemberId: unassigned ? null : (options.staffMemberId ?? staff.id), startAt, endAt,
        durationMinutes: 30, schedulingPolicyVersion: 1, slotStepMinutesSnapshot: 15,
        publicMinNoticeMinutesSnapshot: 120, publicMaxAdvanceDaysSnapshot: 60,
        publicCancelNoticeMinutesSnapshot: 120, timezoneSnapshot: 'America/Argentina/Buenos_Aires',
        serviceSelectionModeSnapshot: unassigned ? 'NO_ASSIGNMENT' : 'CUSTOMER_CHOICE',
        assignmentKind: unassigned ? 'NONE' : 'SPECIFIC', customerNameSnapshot: 'Test customer',
        serviceNameSnapshot: unassigned ? 'Unassigned service' : 'Staff service', staffNameSnapshot: unassigned ? null : 'Test staff',
        status: options.status ?? 'CONFIRMED', source: 'MEMBER', createdByMembershipId: membership.id,
      } });
    }

    const first = await insertAppointment({ start: '2035-02-01T10:00:00.000Z' });
    await insertAppointment({ start: '2035-02-01T10:30:00.000Z' });
    await expect(insertAppointment({ start: '2035-02-01T10:15:00.000Z' })).rejects.toThrow();
    await h.db.appointment.update({ where: { id: first.id }, data: { status: 'CANCELLED' } });
    await insertAppointment({ start: '2035-02-01T10:00:00.000Z' });
    const completed = await insertAppointment({ start: '2035-02-01T12:00:00.000Z', status: 'COMPLETED' });
    await expect(insertAppointment({ start: '2035-02-01T12:00:00.000Z' })).rejects.toThrow();
    await h.db.appointment.update({ where: { id: completed.id }, data: { status: 'NO_SHOW' } });
    await expect(insertAppointment({ start: '2035-02-01T12:00:00.000Z' })).rejects.toThrow();

    await insertAppointment({ start: '2035-02-01T14:00:00.000Z', serviceId: noAssignmentService.id });
    await expect(insertAppointment({ start: '2035-02-01T14:15:00.000Z', serviceId: noAssignmentService.id })).rejects.toThrow();
    await expect(h.db.appointment.create({ data: {
      organizationId, customerId: customer.id, serviceId: service.id, staffMemberId: staff.id,
      startAt: new Date('2035-02-01T16:00:00.000Z'), endAt: new Date('2035-02-01T16:29:00.000Z'),
      durationMinutes: 30, schedulingPolicyVersion: 1, slotStepMinutesSnapshot: 15,
      publicMinNoticeMinutesSnapshot: 120, publicMaxAdvanceDaysSnapshot: 60, publicCancelNoticeMinutesSnapshot: 120,
      timezoneSnapshot: 'America/Argentina/Buenos_Aires', serviceSelectionModeSnapshot: 'CUSTOMER_CHOICE', assignmentKind: 'SPECIFIC',
      customerNameSnapshot: 'Test customer', serviceNameSnapshot: 'Staff service', staffNameSnapshot: 'Test staff',
      source: 'MEMBER', createdByMembershipId: membership.id,
    } })).rejects.toThrow();

    const foreignOwner = await h.user();
    const foreign = await h.organizations.createInitial(foreignOwner.principal, randomUUID(), {
      name: 'Foreign appointment tenant', slug: `foreign-${randomUUID().slice(0, 12)}`, businessType: 'SERVICES', planCode: 'BASIC',
    });
    h.ownedOrganizations.add(foreign.organization.id);
    const foreignService = await h.db.service.create({ data: {
      organizationId: foreign.organization.id, name: 'Foreign service', nameKey: 'foreign service', durationMinutes: 30, currency: 'ARS', staffSelectionMode: 'CUSTOMER_CHOICE',
    } });
    await expect(h.db.appointment.create({ data: {
      organizationId, customerId: customer.id, serviceId: foreignService.id, staffMemberId: staff.id,
      startAt: new Date('2035-02-01T18:00:00.000Z'), endAt: new Date('2035-02-01T18:30:00.000Z'),
      durationMinutes: 30, schedulingPolicyVersion: 1, slotStepMinutesSnapshot: 15,
      publicMinNoticeMinutesSnapshot: 120, publicMaxAdvanceDaysSnapshot: 60, publicCancelNoticeMinutesSnapshot: 120,
      timezoneSnapshot: 'America/Argentina/Buenos_Aires', serviceSelectionModeSnapshot: 'CUSTOMER_CHOICE', assignmentKind: 'SPECIFIC',
      customerNameSnapshot: 'Test customer', serviceNameSnapshot: 'Cross-tenant service', staffNameSnapshot: 'Test staff',
      source: 'MEMBER', createdByMembershipId: membership.id,
    } })).rejects.toThrow();
  });

  it('enforces booking calendar uniqueness, non-overlapping windows, and scheduling setting bounds', async () => {
    const owner = await h.user();
    const created = await h.organizations.createInitial(owner.principal, randomUUID(), {
      name: 'Calendar constraints test', slug: `calendar-${randomUUID().slice(0, 12)}`, businessType: 'SERVICES', planCode: 'BASIC',
    });
    const organizationId = created.organization.id;
    h.ownedOrganizations.add(organizationId);
    const settings = await h.db.schedulingSettings.create({ data: { organizationId } });
    expect(settings).toMatchObject({ slotStepMinutes: 15, publicMinNoticeMinutes: 120, publicCancelNoticeMinutes: 120, publicMaxAdvanceDays: 60 });
    await expect(h.db.schedulingSettings.update({ where: { organizationId }, data: { slotStepMinutes: 20 } })).rejects.toThrow();
    await expect(h.db.schedulingSettings.update({ where: { organizationId }, data: { publicMaxAdvanceDays: 366 } })).rejects.toThrow();

    const calendar = await h.db.bookingCalendar.create({ data: { organizationId, kind: 'BUSINESS' } });
    await expect(h.db.bookingCalendar.create({ data: { organizationId, kind: 'BUSINESS' } })).rejects.toThrow();
    await h.db.calendarWeeklyWindow.create({ data: { organizationId, calendarId: calendar.id, weekday: 1, startMinute: 540, endMinute: 600 } });
    await h.db.calendarWeeklyWindow.create({ data: { organizationId, calendarId: calendar.id, weekday: 1, startMinute: 600, endMinute: 660 } });
    await expect(h.db.calendarWeeklyWindow.create({ data: { organizationId, calendarId: calendar.id, weekday: 1, startMinute: 599, endMinute: 700 } })).rejects.toThrow();
    await expect(h.db.calendarWeeklyWindow.create({ data: { organizationId, calendarId: calendar.id, weekday: 7, startMinute: 0, endMinute: 60 } })).rejects.toThrow();
  });
});
