import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Clock } from '../common/clock.js';
import { ApiError } from '../common/errors.js';
import { parseIfMatch } from '../common/if-match.js';
import { PrismaService } from '../database/prisma.service.js';
import type { TransactionContext } from '../common/transaction.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import type { TenantContext } from '../organizations/tenant.guard.js';
import type { BookingScope } from '../availability/scheduling-read.service.js';
import { RelatedResourceStatus, type StaffServiceListQueryDto } from './staff-services.dto.js';
import { staffServiceDto } from './staff-services.mapper.js';

function serviceNotFound(): ApiError {
  return new ApiError(404, 'SERVICE_NOT_FOUND', 'No se encontró el servicio.');
}

function staffNotFound(): ApiError {
  return new ApiError(404, 'STAFF_MEMBER_NOT_FOUND', 'No se encontró el profesional.');
}

function versionConflict(): ApiError {
  return new ApiError(412, 'VERSION_CONFLICT', 'El servicio cambió desde la última lectura. Recargá y conciliá los cambios.');
}

function page(query: StaffServiceListQueryDto, rows: unknown[]) {
  const hasMore = rows.length > query.limit;
  const nextOffset = hasMore && query.offset + query.limit <= 10_000 ? query.offset + query.limit : null;
  return { items: rows.slice(0, query.limit), pageInfo: { limit: query.limit, offset: query.offset, hasMore, nextOffset, windowLimitReached: hasMore && nextOffset === null } };
}

function relatedActiveFilter(status: RelatedResourceStatus, field: 'staffMember' | 'service'): Prisma.StaffServiceWhereInput {
  if (status === RelatedResourceStatus.ALL) return {};
  return { [field]: { active: status === RelatedResourceStatus.ACTIVE } } as Prisma.StaffServiceWhereInput;
}

@Injectable()
export class StaffServicesService {
  constructor(
    private readonly db: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly clock: Clock,
  ) {}

  async listEligibleStaff(scope: BookingScope, serviceId: string, tx: TransactionContext = this.db) {
    const rows = await tx.staffService.findMany({
      where: { organizationId: scope.organizationId, serviceId, staffMember: { active: true } },
      select: { staffMember: { select: { id: true, name: true } } },
      orderBy: { staffMemberId: 'asc' },
    });
    return rows.map(row => row.staffMember);
  }

  async listForService(context: TenantContext, serviceId: string, query: StaffServiceListQueryDto) {
    const service = await this.db.service.findFirst({ where: { id: serviceId, organizationId: context.organizationId } });
    if (!service) throw serviceNotFound();
    const rows = await this.db.staffService.findMany({
      where: { organizationId: context.organizationId, serviceId, ...relatedActiveFilter(query.status, 'staffMember') },
      include: { staffMember: true, service: true },
      orderBy: [{ createdAt: 'asc' }, { staffMemberId: 'asc' }],
      skip: query.offset,
      take: query.limit + 1,
    });
    return page(query, rows.map(staffServiceDto));
  }

  async listForStaff(context: TenantContext, staffMemberId: string, query: StaffServiceListQueryDto) {
    const staff = await this.db.staffMember.findFirst({ where: { id: staffMemberId, organizationId: context.organizationId } });
    if (!staff) throw staffNotFound();
    const rows = await this.db.staffService.findMany({
      where: { organizationId: context.organizationId, staffMemberId, ...relatedActiveFilter(query.status, 'service') },
      include: { staffMember: true, service: true },
      orderBy: [{ createdAt: 'asc' }, { serviceId: 'asc' }],
      skip: query.offset,
      take: query.limit + 1,
    });
    return page(query, rows.map(staffServiceDto));
  }

  async assign(context: TenantContext, serviceId: string, staffMemberId: string, ifMatch: string | undefined) {
    const version = parseIfMatch(ifMatch);
    return this.db.$transaction(async tx => {
      const lockedService = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Service"
        WHERE "id" = ${serviceId}::uuid AND "organizationId" = ${context.organizationId}::uuid
        FOR UPDATE`;
      if (!lockedService.length) throw serviceNotFound();
      const currentService = await tx.service.findFirst({ where: { id: serviceId, organizationId: context.organizationId } });
      if (!currentService) throw serviceNotFound();
      if (currentService.version !== version) throw versionConflict();

      const lockedStaff = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "StaffMember"
        WHERE "id" = ${staffMemberId}::uuid AND "organizationId" = ${context.organizationId}::uuid
        FOR UPDATE`;
      if (!lockedStaff.length) throw staffNotFound();
      const staff = await tx.staffMember.findFirst({ where: { id: staffMemberId, organizationId: context.organizationId } });
      if (!staff) throw staffNotFound();

      const existing = await tx.staffService.findFirst({
        where: { organizationId: context.organizationId, serviceId, staffMemberId },
        include: { staffMember: true, service: true },
      });
      if (existing) return { association: staffServiceDto(existing), serviceVersion: currentService.version };
      if (!currentService.active || !staff.active) {
        throw new ApiError(409, 'RELATED_ENTITY_INACTIVE', 'Sólo se pueden habilitar servicios y profesionales activos.');
      }

      const now = this.clock.now();
      await tx.staffService.create({ data: { organizationId: context.organizationId, serviceId, staffMemberId, createdAt: now } });
      const updated = await tx.service.updateMany({
        where: { id: serviceId, organizationId: context.organizationId, version },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      if (updated.count !== 1) throw versionConflict();
      const relation = await tx.staffService.findFirst({
        where: { organizationId: context.organizationId, serviceId, staffMemberId },
        include: { staffMember: true, service: true },
      });
      if (!relation) throw serviceNotFound();
      await this.organizations.recordOperationalAudit(tx, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'STAFF_SERVICE_ASSIGNED',
        targetId: serviceId,
        changedFields: ['staffMemberId'],
      });
      return { association: staffServiceDto(relation), serviceVersion: version + 1 };
    });
  }

  async unassign(context: TenantContext, serviceId: string, staffMemberId: string, ifMatch: string | undefined) {
    const version = parseIfMatch(ifMatch);
    return this.db.$transaction(async tx => {
      const lockedService = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Service"
        WHERE "id" = ${serviceId}::uuid AND "organizationId" = ${context.organizationId}::uuid
        FOR UPDATE`;
      if (!lockedService.length) throw serviceNotFound();
      const currentService = await tx.service.findFirst({ where: { id: serviceId, organizationId: context.organizationId } });
      if (!currentService) throw serviceNotFound();
      if (currentService.version !== version) throw versionConflict();
      const staff = await tx.staffMember.findFirst({ where: { id: staffMemberId, organizationId: context.organizationId }, select: { id: true } });
      if (!staff) throw staffNotFound();
      const existing = await tx.staffService.findFirst({ where: { organizationId: context.organizationId, serviceId, staffMemberId } });
      if (!existing) return { serviceVersion: currentService.version };

      const now = this.clock.now();
      await tx.staffService.delete({ where: { organizationId_staffMemberId_serviceId: { organizationId: context.organizationId, staffMemberId, serviceId } } });
      const updated = await tx.service.updateMany({
        where: { id: serviceId, organizationId: context.organizationId, version },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      if (updated.count !== 1) throw versionConflict();
      await this.organizations.recordOperationalAudit(tx, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'STAFF_SERVICE_UNASSIGNED',
        targetId: serviceId,
        changedFields: ['staffMemberId'],
      });
      return { serviceVersion: version + 1 };
    });
  }
}
