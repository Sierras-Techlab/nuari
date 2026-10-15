import { describe, expect, it, vi } from 'vitest';
import { deriveManagementToken, hashManagementToken } from './management-token.js';
import { PublicBookingService } from './public-booking.service.js';

const now = new Date('2027-05-01T12:00:00.000Z');
const secret = 'm'.repeat(32);

function setup() {
  const appointment = {
    id: 'appointment-1', organizationId: 'organization-1', source: 'PUBLIC',
    managementTokenHash: '', managementTokenKeyVersion: 1, managementTokenVersion: 1,
    managementTokenExpiresAt: new Date('2027-06-01T00:00:00.000Z'),
    status: 'CONFIRMED', startAt: new Date('2027-05-20T15:00:00.000Z'), endAt: new Date('2027-05-20T15:30:00.000Z'),
    durationMinutes: 30, serviceId: 'service-1', serviceNameSnapshot: 'Corte', staffNameSnapshot: 'Ana',
    staffMemberId: 'staff-1', assignmentKind: 'SPECIFIC', serviceSelectionModeSnapshot: 'CUSTOMER_CHOICE',
    timezoneSnapshot: 'America/Argentina/Buenos_Aires', version: 7, publicCancelNoticeMinutesSnapshot: 60,
  };
  const token = deriveManagementToken(secret, appointment.organizationId, appointment.id, appointment.managementTokenVersion);
  appointment.managementTokenHash = hashManagementToken(token);
  const db = {
    organization: { findUnique: vi.fn().mockResolvedValue({ id: appointment.organizationId, timezone: appointment.timezoneSnapshot }) },
    appointment: { findFirst: vi.fn().mockResolvedValue(appointment) },
    schedulingSettings: { findUnique: vi.fn().mockResolvedValue({ publicBookingEnabled: true }) },
    subscription: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', paidThrough: new Date('2027-07-01T00:00:00Z') }) },
    service: { findFirst: vi.fn().mockResolvedValue({ id: 'service-1', staffSelectionMode: 'CUSTOMER_CHOICE' }) },
  };
  const availability = { findPublicForReschedule: vi.fn().mockResolvedValue({ slots: [], hasMore: false, nextCursor: null, timeZone: appointment.timezoneSnapshot }) };
  const clock = { now: () => now };
  const security = { managementTokenSecretFor: () => secret };
  const service = new PublicBookingService(db as never, availability as never, {} as never, {} as never, clock as never, security as never, {} as never);
  return { service, db, availability, appointment, token };
}

describe('PublicBookingService management contracts', () => {
  it('resolves only the minimal rescheduling identity and current assignment', async () => {
    const { service, db, appointment, token } = setup();
    const result = await service.resolve('estudio', { token });
    expect(result).toMatchObject({
      id: appointment.id, serviceId: appointment.serviceId, staffSelectionMode: 'CUSTOMER_CHOICE',
      assignment: { kind: 'SPECIFIC', staffMemberId: 'staff-1' },
      actions: { canReschedule: true },
    });
    expect(db.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: appointment.serviceId, organizationId: appointment.organizationId, active: true, publicBookable: true },
      select: { id: true, staffSelectionMode: true },
    }));
    expect(result).not.toHaveProperty('organizationId');
    expect(result).not.toHaveProperty('customerEmailSnapshot');
  });

  it('does not advertise rescheduling when the current service mode differs from the booking snapshot', async () => {
    const { service, db, token } = setup();
    db.service.findFirst.mockResolvedValue({ id: 'service-1', staffSelectionMode: 'AUTO_ASSIGN' });
    const result = await service.resolve('estudio', { token });
    expect(result.staffSelectionMode).toBe('AUTO_ASSIGN');
    expect(result.actions.canReschedule).toBe(false);
  });

  it('queries rebooking availability only for the token-bound booking and version', async () => {
    const { service, availability, appointment, token } = setup();
    const result = await service.findRescheduleAvailability('estudio', appointment.id, {
      token, selection: 'SPECIFIC', staffMemberId: 'staff-1', fromDate: '2027-05-20', toDate: '2027-05-21',
    }, '"7"');
    expect(availability.findPublicForReschedule).toHaveBeenCalledWith('estudio', {
      serviceId: appointment.serviceId, selection: 'SPECIFIC', staffMemberId: 'staff-1', fromDate: '2027-05-20', toDate: '2027-05-21',
    }, appointment.id);
    expect(result).toMatchObject({ slots: [], timeZone: appointment.timezoneSnapshot });
  });

  it('does not query availability when the route appointment does not match the management token', async () => {
    const { service, availability, token } = setup();
    await expect(service.findRescheduleAvailability('estudio', 'different-appointment', {
      token, selection: 'ANY', fromDate: '2027-05-20', toDate: '2027-05-21',
    }, '"7"')).rejects.toMatchObject({ response: { code: 'MANAGEMENT_LINK_NOT_AVAILABLE' } });
    expect(availability.findPublicForReschedule).not.toHaveBeenCalled();
  });

  it('rejects stale availability reads using If-Match before querying slots', async () => {
    const { service, availability, appointment, token } = setup();
    await expect(service.findRescheduleAvailability('estudio', appointment.id, {
      token, selection: 'ANY', fromDate: '2027-05-20', toDate: '2027-05-21',
    }, '"6"')).rejects.toMatchObject({ status: 412, response: { code: 'VERSION_CONFLICT' } });
    expect(availability.findPublicForReschedule).not.toHaveBeenCalled();
  });
});
