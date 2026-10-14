import { Injectable } from '@nestjs/common';
import { Prisma, type StaffMember } from '../generated/prisma/client.js';
import { Clock } from '../common/clock.js';
import { ApiError } from '../common/errors.js';
import { parseIfMatch } from '../common/if-match.js';
import { PrismaService } from '../database/prisma.service.js';
import type { OperationalAuditAction, OperationalAuditField } from '../organizations/organizations.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import type { TenantContext } from '../organizations/tenant.guard.js';
import { StaffStatusFilter, type CreateStaffMemberDto, type StaffListQueryDto, type UpdateStaffMemberDto } from './staff.dto.js';
import { staffDetailDto, staffSummaryDto } from './staff.mapper.js';

function notFound(): ApiError {
  return new ApiError(404, 'STAFF_MEMBER_NOT_FOUND', 'No se encontró el profesional.');
}

function conflict(): ApiError {
  return new ApiError(412, 'VERSION_CONFLICT', 'El profesional cambió desde la última lectura. Recargá y conciliá los cambios.');
}

function activeFilter(status: StaffStatusFilter): Pick<Prisma.StaffMemberWhereInput, 'active'> | undefined {
  if (status === StaffStatusFilter.ACTIVE) return { active: true };
  if (status === StaffStatusFilter.INACTIVE) return { active: false };
  return undefined;
}

function updateFields(input: UpdateStaffMemberDto): OperationalAuditField[] {
  const fields: OperationalAuditField[] = [];
  if (input.name !== undefined) fields.push('name');
  if (input.email !== undefined) fields.push('email');
  if (input.phone !== undefined) fields.push('phone');
  if (input.active !== undefined) fields.push('active');
  return fields;
}

function changedFields(current: StaffMember, input: UpdateStaffMemberDto): OperationalAuditField[] {
  return updateFields(input).filter(field => {
    switch (field) {
      case 'name': return current.name !== input.name;
      case 'email': return current.email !== (input.email ?? null);
      case 'phone': return current.phone !== (input.phone ?? null);
      case 'active': return current.active !== input.active;
      default: return false;
    }
  });
}

@Injectable()
export class StaffService {
  constructor(
    private readonly db: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly clock: Clock,
  ) {}

  async list(context: TenantContext, query: StaffListQueryDto) {
    const search = query.q;
    const where: Prisma.StaffMemberWhereInput = {
      organizationId: context.organizationId,
      ...activeFilter(query.status),
      ...(search === undefined ? {} : { name: { contains: search, mode: 'insensitive' } }),
      ...(query.serviceId === undefined ? {} : { serviceLinks: { some: { serviceId: query.serviceId } } }),
    };
    if (query.serviceId !== undefined) {
      const service = await this.db.service.findFirst({ where: { id: query.serviceId, organizationId: context.organizationId } });
      if (!service) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'No se encontró el servicio.');
    }
    const rows = await this.db.staffMember.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: query.offset,
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const nextOffset = hasMore && query.offset + query.limit <= 10_000 ? query.offset + query.limit : null;
    return {
      items: rows.slice(0, query.limit).map(staffSummaryDto),
      pageInfo: { limit: query.limit, offset: query.offset, hasMore, nextOffset, windowLimitReached: hasMore && nextOffset === null },
    };
  }

  async get(context: TenantContext, staffMemberId: string) {
    const staff = await this.db.staffMember.findFirst({ where: { id: staffMemberId, organizationId: context.organizationId } });
    if (!staff) throw notFound();
    return staffDetailDto(staff);
  }

  async create(context: TenantContext, input: CreateStaffMemberDto) {
    return this.db.$transaction(async tx => {
      const now = this.clock.now();
      const staff = await tx.staffMember.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          active: true,
          userId: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
      const fields: OperationalAuditField[] = ['name'];
      if (input.email !== undefined) fields.push('email');
      if (input.phone !== undefined) fields.push('phone');
      await this.organizations.recordOperationalAudit(tx, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'STAFF_MEMBER_CREATED',
        targetId: staff.id,
        changedFields: fields,
      });
      return staffDetailDto(staff);
    });
  }

  async update(context: TenantContext, staffMemberId: string, input: UpdateStaffMemberDto, ifMatch: string | undefined) {
    return this.db.$transaction(async tx => {
      const where = { id: staffMemberId, organizationId: context.organizationId };
      const current = await tx.staffMember.findFirst({ where });
      if (!current) throw notFound();
      const version = parseIfMatch(ifMatch);
      if (current.version !== version) throw conflict();

      const data: Prisma.StaffMemberUpdateManyMutationInput = {
        version: { increment: 1 },
        updatedAt: this.clock.now(),
      };
      if (input.name !== undefined) data.name = input.name;
      if (input.email !== undefined) data.email = input.email;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.active !== undefined) data.active = input.active;

      const result = await tx.staffMember.updateMany({ where: { ...where, version }, data });
      if (result.count !== 1) throw conflict();
      const updated = await tx.staffMember.findFirst({ where });
      if (!updated) throw notFound();
      const action: OperationalAuditAction = input.active === false && current.active
        ? 'STAFF_MEMBER_ARCHIVED'
        : input.active === true && !current.active
          ? 'STAFF_MEMBER_REACTIVATED'
          : 'STAFF_MEMBER_UPDATED';
      await this.organizations.recordOperationalAudit(tx, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action,
        targetId: updated.id,
        changedFields: changedFields(current, input),
      });
      return staffDetailDto(updated);
    });
  }
}
