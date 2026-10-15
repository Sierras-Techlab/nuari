import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../common/errors.js';
import { AvailabilityService } from './availability.service.js';

describe('AvailabilityService query shape', () => {
  it('routes a token-authorized reschedule query through the tenant slug and exact appointment exclusion', async () => {
    const db = { organization: { findUnique: vi.fn().mockResolvedValue({ id: 'organization-1' }) }, $transaction: vi.fn() };
    const service = new AvailabilityService(db as never, {} as never, {} as never, {} as never, {} as never);
    const find = vi.spyOn(service as unknown as { findWithExclusion: (...args: unknown[]) => Promise<unknown> }, 'findWithExclusion')
      .mockResolvedValue({ slots: [], hasMore: false, nextCursor: null, timeZone: 'UTC' });
    const query = { serviceId: 'service-1', selection: 'ANY' as const, fromDate: '2027-05-20', toDate: '2027-05-21' };
    await service.findPublicForReschedule('business-slug', query, 'appointment-1');
    expect(db.organization.findUnique).toHaveBeenCalledWith({ where: { slug: 'business-slug' }, select: { id: true } });
    expect(find).toHaveBeenCalledWith({ organizationId: 'organization-1' }, query, true, 'business-slug', 'appointment-1');
  });

  it('rejects an instant combined with a partial date range', async () => {
    const db = { $transaction: vi.fn() };
    const service = new AvailabilityService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const request = service.find(
      { organizationId: 'org-id', userId: 'user-id', role: 'OWNER' } as never,
      { serviceId: 'service-id', selection: 'ANY', at: '2027-05-14T16:00:00-03:00', fromDate: '2027-05-14' },
    );
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 400 });
    await expect(request).rejects.toHaveProperty('response.code', 'VALIDATION_ERROR');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
