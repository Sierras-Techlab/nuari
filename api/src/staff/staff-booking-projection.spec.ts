import { describe, expect, it, vi } from 'vitest';
import { StaffServicesService } from './staff-services.service.js';

describe('StaffServicesService booking projection', () => {
  it('returns only active, service-enabled staff IDs and names in deterministic order', async () => {
    const db = {
      staffService: { findMany: vi.fn().mockResolvedValue([
        { staffMember: { id: 'staff-a', name: 'Ana' } }, { staffMember: { id: 'staff-b', name: 'Beto' } },
      ]) },
    };
    const service = new StaffServicesService(db as never, {} as never, {} as never);
    await expect(service.listEligibleStaff({ organizationId: 'tenant-a' }, 'service-a'))
      .resolves.toEqual([{ id: 'staff-a', name: 'Ana' }, { id: 'staff-b', name: 'Beto' }]);
    expect(db.staffService.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'tenant-a', serviceId: 'service-a', staffMember: { active: true } },
      select: { staffMember: { select: { id: true, name: true } } },
      orderBy: { staffMemberId: 'asc' },
    }));
  });
});
