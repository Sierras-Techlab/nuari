import { describe, expect, it, vi } from 'vitest';
import { SchedulingReadService } from './scheduling-read.service.js';

const scope = { organizationId: 'tenant-a' };

function setup() {
  const tx = {
    bookingCalendar: { findUnique: vi.fn(), findFirst: vi.fn() },
    appointment: { findMany: vi.fn() },
    calendarWeeklyWindow: { findFirst: vi.fn() },
    calendarDayOverride: { findFirst: vi.fn() },
  };
  return { service: new SchedulingReadService(), tx };
}

describe('SchedulingReadService', () => {
  it('rejects an empty booking scope instead of issuing a tenantless query', async () => {
    const { service, tx } = setup();
    await expect(service.loadBusyIntervals({ organizationId: '' }, [], {
      startAt: new Date('2025-01-01T00:00:00Z'), endAt: new Date('2025-01-02T00:00:00Z'),
    }, tx as never)).rejects.toMatchObject({ response: { code: 'INVALID_SCHEDULING_SCOPE' } });
    expect(tx.appointment.findMany).not.toHaveBeenCalled();
  });

  it('loads only busy intervals for the requested tenant, resources, and overlapping window', async () => {
    const { service, tx } = setup();
    tx.appointment.findMany.mockResolvedValue([]);
    const window = { startAt: new Date('2025-01-01T00:00:00Z'), endAt: new Date('2025-01-02T00:00:00Z') };
    await service.loadBusyIntervals(scope, [{ kind: 'STAFF', staffMemberId: 'staff-1' }], window, tx as never);
    expect(tx.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: scope.organizationId,
        status: { not: 'CANCELLED' },
        startAt: { lt: window.endAt },
        endAt: { gt: window.startAt },
        OR: [{ staffMemberId: { in: ['staff-1'] } }],
      }),
    }));
  });

  it('excludes only the exact appointment requested while preserving tenant and resource filters', async () => {
    const { service, tx } = setup();
    tx.appointment.findMany.mockResolvedValue([]);
    const window = { startAt: new Date('2025-01-01T00:00:00Z'), endAt: new Date('2025-01-02T00:00:00Z') };
    await service.loadBusyIntervals(scope, [{ kind: 'STAFF', staffMemberId: 'staff-1' }], window, tx as never, 'appointment-1');
    expect(tx.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: scope.organizationId,
        id: { not: 'appointment-1' },
        OR: [{ staffMemberId: { in: ['staff-1'] } }],
      }),
    }));
  });

  it('blocks a timezone change while confirmed future bookings exist', async () => {
    const { service, tx } = setup();
    tx.appointment.findMany.mockResolvedValueOnce([{ id: 'appointment-1' }]);
    await expect(service.assertTimeZoneChangeAllowed(scope, tx as never, new Date('2025-01-01T00:00:00Z')))
      .rejects.toThrow(expect.objectContaining({ status: 409, response: expect.objectContaining({ code: 'TIMEZONE_CHANGE_BLOCKED' }) }));
  });

  it('blocks a timezone change conservatively while non-empty calendar rules exist', async () => {
    const { service, tx } = setup();
    tx.appointment.findMany.mockResolvedValueOnce([]);
    tx.calendarWeeklyWindow.findFirst.mockResolvedValueOnce({ id: 'window-1' });
    await expect(service.assertTimeZoneChangeAllowed(scope, tx as never, new Date('2025-01-01T00:00:00Z')))
      .rejects.toThrow(expect.objectContaining({ status: 409, response: expect.objectContaining({ code: 'TIMEZONE_CHANGE_BLOCKED' }) }));
  });

  it('does not block a timezone change when there are no future appointments or calendar rules', async () => {
    const { service, tx } = setup();
    tx.appointment.findMany.mockResolvedValueOnce([]);
    tx.calendarWeeklyWindow.findFirst.mockResolvedValueOnce(null);
    tx.calendarDayOverride.findFirst.mockResolvedValueOnce(null);
    await expect(service.assertTimeZoneChangeAllowed(scope, tx as never, new Date('2025-01-01T00:00:00Z'))).resolves.toBeUndefined();
  });
});
