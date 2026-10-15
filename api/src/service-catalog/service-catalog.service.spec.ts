import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { ServiceCatalogService } from './service-catalog.service.js';

const now = new Date('2026-10-14T12:00:00.000Z');
const context = { userId: 'user-id', organizationId: 'org-id', membershipId: 'member-id', role: 'OWNER' as const };

function setup(currency = 'ARS') {
  const serviceRow = {
    id: 'service-id', organizationId: context.organizationId, name: 'Corte', nameKey: 'corte',
    description: null, durationMinutes: 40, pricingType: 'FIXED' as const, price: new Prisma.Decimal('0'),
    currency, categoryId: null, active: true, sortOrder: 0, staffSelectionMode: 'NO_ASSIGNMENT' as const,
    modality: 'IN_PERSON' as const, version: 1, createdAt: now, updatedAt: now,
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: context.organizationId }]),
    organization: { findUnique: vi.fn().mockResolvedValue({ currency }) },
    serviceCategory: { findFirst: vi.fn().mockResolvedValue(null) },
    service: { create: vi.fn().mockResolvedValue(serviceRow), findFirst: vi.fn().mockResolvedValue(serviceRow), findMany: vi.fn(), updateMany: vi.fn() },
  };
  const db = { $transaction: vi.fn((callback: (value: typeof tx) => unknown) => callback(tx)), service: tx.service, serviceCategory: tx.serviceCategory };
  const organizations = { recordOperationalAudit: vi.fn().mockResolvedValue(undefined) };
  const clock = { now: vi.fn().mockReturnValue(now) };
  return { catalog: new ServiceCatalogService(db as never, organizations as never, clock as never), db, tx, organizations };
}

describe('ServiceCatalogService', () => {
  it('exposes a tenant-scoped service requirement for cooperating modules', async () => {
    const { catalog, db } = setup();
    await expect(catalog.requireService(context, 'service-id')).resolves.toMatchObject({ id: 'service-id' });
    expect(db.service.findFirst).toHaveBeenCalledWith({ where: { id: 'service-id', organizationId: context.organizationId } });
  });

  it('exposes an active bookable-service projection without returning financial fields', async () => {
    const { catalog, tx } = setup();
    await expect(catalog.getBookableService({ organizationId: context.organizationId }, 'service-id')).resolves.toMatchObject({
      id: 'service-id', durationMinutes: 40, staffSelectionMode: 'NO_ASSIGNMENT', active: true,
    });
    expect(tx.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'service-id', organizationId: context.organizationId, active: true },
      select: expect.objectContaining({ id: true, durationMinutes: true, staffSelectionMode: true }),
    }));
  });

  it('locks and reads the tenant currency before persisting an exact zero price', async () => {
    const { catalog, tx, organizations } = setup();
    const result = await catalog.create(context, {
      name: 'Corte', durationMinutes: 40, pricingType: 'FIXED', price: '0.00',
      staffSelectionMode: 'NO_ASSIGNMENT', sortOrder: 0, modality: 'IN_PERSON',
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.organization.findUnique).toHaveBeenCalledWith({ where: { id: context.organizationId }, select: { currency: true } });
    expect(tx.service.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: context.organizationId, price: new Prisma.Decimal('0.00'), currency: 'ARS',
    }) });
    expect(result.price).toBe('0.00');
    expect(organizations.recordOperationalAudit).toHaveBeenCalledOnce();
  });

  it('rejects CLP fractional prices before any write', async () => {
    const { catalog, tx } = setup('CLP');
    await expect(catalog.create(context, {
      name: 'Corte', durationMinutes: 40, pricingType: 'FIXED', price: '12.50',
      staffSelectionMode: 'NO_ASSIGNMENT', sortOrder: 0, modality: 'IN_PERSON',
    })).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_ERROR' } });
    expect(tx.service.create).not.toHaveBeenCalled();
  });

  it('requires an explicit pricing mode and price coherence on writes', async () => {
    const { catalog, tx } = setup();
    await expect(catalog.create(context, {
      name: 'Consultar', durationMinutes: 40, pricingType: 'ON_REQUEST', price: '0.00',
      staffSelectionMode: 'NO_ASSIGNMENT', sortOrder: 0, modality: 'IN_PERSON',
    })).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_ERROR' } });
    expect(tx.service.create).not.toHaveBeenCalled();
  });
});
