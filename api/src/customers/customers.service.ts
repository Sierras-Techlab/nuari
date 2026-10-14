import { Injectable } from '@nestjs/common';
import { Prisma, type Customer } from '../generated/prisma/client.js';
import { Clock } from '../common/clock.js';
import { ApiError } from '../common/errors.js';
import { parseIfMatch } from '../common/if-match.js';
import { PrismaService } from '../database/prisma.service.js';
import type { OperationalAuditAction, OperationalAuditField } from '../organizations/organizations.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import type { TenantContext } from '../organizations/tenant.guard.js';
import { CustomerStatusFilter, type CreateCustomerDto, type CustomerListQueryDto, type DuplicateCustomerCandidatesQueryDto, type UpdateCustomerDto } from './customers.dto.js';
import { customerDetailDto, customerSummaryDto } from './customers.mapper.js';

function notFound(): ApiError {
  return new ApiError(404, 'CUSTOMER_NOT_FOUND', 'No se encontró el cliente.');
}

function conflict(): ApiError {
  return new ApiError(412, 'VERSION_CONFLICT', 'El cliente cambió desde la última lectura. Recargá y conciliá los cambios.');
}

export function normalizeCustomerEmail(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.trim().toLowerCase() || null;
}

export function normalizeCustomerPhone(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const phone = value.trim();
  if (!phone) return null;
  const prefix = phone.startsWith('+') ? '+' : '';
  const digits = phone.replace(/\D/g, '');
  return digits ? `${prefix}${digits}` : null;
}

function updateFields(input: UpdateCustomerDto): OperationalAuditField[] {
  const fields: OperationalAuditField[] = [];
  if (input.name !== undefined) fields.push('name');
  if (input.phone !== undefined) fields.push('phone');
  if (input.email !== undefined) fields.push('email');
  if (input.notes !== undefined) fields.push('notes');
  if (input.active !== undefined) fields.push('active');
  return fields;
}

function changedFields(current: Customer, input: UpdateCustomerDto): OperationalAuditField[] {
  return updateFields(input).filter(field => {
    switch (field) {
      case 'name': return current.name !== input.name;
      case 'phone': return current.phone !== (input.phone ?? null) || current.phoneNormalized !== normalizeCustomerPhone(input.phone);
      case 'email': return current.email !== normalizeCustomerEmail(input.email);
      case 'notes': return current.notes !== (input.notes ?? null);
      case 'active': return current.active !== input.active;
      default: return false;
    }
  });
}

function activeFilter(status: CustomerStatusFilter): Pick<Prisma.CustomerWhereInput, 'active'> | undefined {
  if (status === CustomerStatusFilter.ACTIVE) return { active: true };
  if (status === CustomerStatusFilter.INACTIVE) return { active: false };
  return undefined;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly db: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly clock: Clock,
  ) {}

  async list(context: TenantContext, query: CustomerListQueryDto) {
    const search = query.q === undefined ? undefined : escapeLikePattern(query.q);
    const where: Prisma.CustomerWhereInput = {
      organizationId: context.organizationId,
      ...activeFilter(query.status),
      ...(search === undefined ? {} : {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const rows = await this.db.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const nextOffset = hasMore && query.offset + query.limit <= 10_000 ? query.offset + query.limit : null;
    return {
      items: rows.slice(0, query.limit).map(customerSummaryDto),
      pageInfo: { limit: query.limit, offset: query.offset, hasMore, nextOffset, windowLimitReached: hasMore && nextOffset === null },
    };
  }

  async duplicateCandidates(context: TenantContext, query: DuplicateCustomerCandidatesQueryDto) {
    const email = normalizeCustomerEmail(query.email);
    const phoneNormalized = normalizeCustomerPhone(query.phone);
    if (!email && !phoneNormalized) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá un email o un teléfono para buscar coincidencias.', {
        email: ['Indicá un email o un teléfono.'], phone: ['Indicá un email o un teléfono.'],
      });
    }
    const OR: Prisma.CustomerWhereInput[] = [];
    if (email) OR.push({ email });
    if (phoneNormalized) OR.push({ phoneNormalized });
    const rows = await this.db.customer.findMany({
      where: {
        organizationId: context.organizationId,
        ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
        OR,
      },
      orderBy: [{ id: 'asc' }],
      take: 11,
    });
    return { items: rows.slice(0, 10).map(customerSummaryDto), hasMore: rows.length > 10 };
  }

  async get(context: TenantContext, customerId: string) {
    const customer = await this.db.customer.findFirst({ where: { id: customerId, organizationId: context.organizationId } });
    if (!customer) throw notFound();
    return customerDetailDto(customer, context);
  }

  async create(context: TenantContext, input: CreateCustomerDto) {
    return this.db.$transaction(async tx => {
      const now = this.clock.now();
      const customer = await tx.customer.create({
        data: {
          organizationId: context.organizationId,
          name: input.name,
          phone: input.phone ?? null,
          phoneNormalized: normalizeCustomerPhone(input.phone),
          email: normalizeCustomerEmail(input.email),
          notes: input.notes ?? null,
          active: true,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
      const fields: OperationalAuditField[] = ['name'];
      if (input.phone !== undefined) fields.push('phone');
      if (input.email !== undefined) fields.push('email');
      if (input.notes !== undefined) fields.push('notes');
      await this.organizations.recordOperationalAudit(tx, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'CUSTOMER_CREATED',
        targetId: customer.id,
        changedFields: fields,
      });
      return customerDetailDto(customer, context);
    });
  }

  async update(context: TenantContext, customerId: string, input: UpdateCustomerDto, ifMatch: string | undefined) {
    return this.db.$transaction(async tx => {
      const where = { id: customerId, organizationId: context.organizationId };
      const current = await tx.customer.findFirst({ where });
      if (!current) throw notFound();
      const version = parseIfMatch(ifMatch);
      if (current.version !== version) throw conflict();

      const data: Prisma.CustomerUpdateManyMutationInput = {
        version: { increment: 1 },
        updatedAt: this.clock.now(),
      };
      if (input.name !== undefined) data.name = input.name;
      if (input.phone !== undefined) {
        data.phone = input.phone;
        data.phoneNormalized = normalizeCustomerPhone(input.phone);
      }
      if (input.email !== undefined) data.email = normalizeCustomerEmail(input.email);
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.active !== undefined) data.active = input.active;

      const result = await tx.customer.updateMany({ where: { ...where, version }, data });
      if (result.count !== 1) throw conflict();
      const updated = await tx.customer.findFirst({ where });
      if (!updated) throw notFound();
      const action: OperationalAuditAction = input.active === false && current.active
        ? 'CUSTOMER_ARCHIVED'
        : input.active === true && !current.active
          ? 'CUSTOMER_REACTIVATED'
          : 'CUSTOMER_UPDATED';
      await this.organizations.recordOperationalAudit(tx, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action,
        targetId: updated.id,
        changedFields: changedFields(current, input),
      });
      return customerDetailDto(updated, context);
    });
  }
}
