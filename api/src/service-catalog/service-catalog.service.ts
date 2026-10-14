import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Clock } from '../common/clock.js';
import { ApiError } from '../common/errors.js';
import { parseIfMatch } from '../common/if-match.js';
import type { TransactionContext } from '../common/transaction.js';
import { PrismaService } from '../database/prisma.service.js';
import type { OperationalAuditAction, OperationalAuditField } from '../organizations/organizations.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import type { TenantContext } from '../organizations/tenant.guard.js';
import { CategoryStatusFilter, type CreateServiceCategoryDto, type ServiceCategoryListQueryDto, type UpdateServiceCategoryDto } from './service-categories.dto.js';
import { isValidServicePrice, ServiceStatusFilter, type CreateServiceDto, type ServiceListQueryDto, type UpdateServiceDto } from './services.dto.js';
import { serviceCategoryDto, serviceDto } from './services.mapper.js';

function serviceNotFound(): ApiError {
  return new ApiError(404, 'SERVICE_NOT_FOUND', 'No se encontró el servicio.');
}

function categoryNotFound(): ApiError {
  return new ApiError(404, 'SERVICE_CATEGORY_NOT_FOUND', 'No se encontró la categoría de servicio.');
}

function versionConflict(resource: 'servicio' | 'categoría'): ApiError {
  return new ApiError(412, 'VERSION_CONFLICT', `La ${resource} cambió desde la última lectura. Recargá y conciliá los cambios.`);
}

function nameKey(name: string): string {
  return name.trim().normalize('NFC').toLowerCase();
}

function activeFilter(status: ServiceStatusFilter | CategoryStatusFilter): Pick<Prisma.ServiceWhereInput, 'active'> | Pick<Prisma.ServiceCategoryWhereInput, 'active'> | undefined {
  if (status === ServiceStatusFilter.ACTIVE) return { active: true };
  if (status === ServiceStatusFilter.INACTIVE) return { active: false };
  return undefined;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function pageInfo(query: { limit: number; offset: number }, rowsLength: number) {
  const hasMore = rowsLength > query.limit;
  const nextOffset = hasMore && query.offset + query.limit <= 10_000 ? query.offset + query.limit : null;
  return { limit: query.limit, offset: query.offset, hasMore, nextOffset, windowLimitReached: hasMore && nextOffset === null };
}

function isP2002(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'P2002';
}

function categoryNameConflict(error: unknown): boolean {
  // These create/update paths have no client-controlled unique fields besides tenant/nameKey.
  return isP2002(error);
}

function serviceNameConflict(error: unknown): boolean {
  return isP2002(error);
}

function validatePrice(pricingType: string, price: string | null | undefined, currency: string): Prisma.Decimal | null {
  if (pricingType === 'ON_REQUEST') {
    if (price !== null && price !== undefined) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Los servicios a consultar no llevan importe.', { price: ['Usá null para servicios a consultar.'] });
    }
    return null;
  }
  if (price === null || price === undefined || !isValidServicePrice(price, currency)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El importe no es válido para la moneda de la organización.', {
      price: [currency === 'CLP' ? 'Ingresá un importe exacto sin fracciones para CLP.' : 'Usá una cadena decimal canónica de hasta 10 enteros y 2 decimales.'],
    });
  }
  return new Prisma.Decimal(price);
}

function auditFields(input: CreateServiceDto | UpdateServiceDto): OperationalAuditField[] {
  const fields: OperationalAuditField[] = [];
  for (const field of ['name', 'description', 'durationMinutes', 'pricingType', 'price', 'categoryId', 'active', 'sortOrder', 'staffSelectionMode', 'modality'] as const) {
    if (Reflect.get(input, field) !== undefined) fields.push(field);
  }
  return fields;
}

@Injectable()
export class ServiceCatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly clock: Clock,
  ) {}

  async requireService(context: TenantContext, serviceId: string, tx: TransactionContext = this.db) {
    const service = await tx.service.findFirst({ where: { id: serviceId, organizationId: context.organizationId } });
    if (!service) throw serviceNotFound();
    return service;
  }

  async listCategories(context: TenantContext, query: ServiceCategoryListQueryDto) {
    const q = query.q === undefined ? undefined : escapeLikePattern(query.q);
    const rows = await this.db.serviceCategory.findMany({
      where: {
        organizationId: context.organizationId,
        ...activeFilter(query.status) as Prisma.ServiceCategoryWhereInput,
        ...(q === undefined ? {} : { name: { contains: q, mode: 'insensitive' } }),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: query.offset,
      take: query.limit + 1,
    });
    return { items: rows.slice(0, query.limit).map(serviceCategoryDto), pageInfo: pageInfo(query, rows.length) };
  }

  async getCategory(context: TenantContext, categoryId: string) {
    const category = await this.db.serviceCategory.findFirst({ where: { id: categoryId, organizationId: context.organizationId } });
    if (!category) throw categoryNotFound();
    return serviceCategoryDto(category);
  }

  async createCategory(context: TenantContext, input: CreateServiceCategoryDto) {
    try {
      return await this.db.$transaction(async tx => {
        const now = this.clock.now();
        const category = await tx.serviceCategory.create({ data: {
          organizationId: context.organizationId, name: input.name, nameKey: nameKey(input.name),
          active: true, sortOrder: input.sortOrder, version: 1, createdAt: now, updatedAt: now,
        } });
        await this.organizations.recordOperationalAudit(tx, {
          organizationId: context.organizationId, actorUserId: context.userId,
          action: 'SERVICE_CATEGORY_CREATED', targetId: category.id, changedFields: ['name', 'sortOrder'],
        });
        return serviceCategoryDto(category);
      });
    } catch (error) {
      if (categoryNameConflict(error)) throw new ApiError(409, 'SERVICE_CATEGORY_NAME_TAKEN', 'Ya existe una categoría con ese nombre.');
      throw error;
    }
  }

  async updateCategory(context: TenantContext, categoryId: string, input: UpdateServiceCategoryDto, ifMatch: string | undefined) {
    const version = parseIfMatch(ifMatch);
    try {
      return await this.db.$transaction(async tx => {
        const where = { id: categoryId, organizationId: context.organizationId };
        const current = await tx.serviceCategory.findFirst({ where });
        if (!current) throw categoryNotFound();
        if (current.version !== version) throw versionConflict('categoría');
        const data: Prisma.ServiceCategoryUpdateManyMutationInput = { version: { increment: 1 }, updatedAt: this.clock.now() };
        if (input.name !== undefined) { data.name = input.name; data.nameKey = nameKey(input.name); }
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
        if (input.active !== undefined) data.active = input.active;
        const changed = await tx.serviceCategory.updateMany({ where: { ...where, version }, data });
        if (changed.count !== 1) throw versionConflict('categoría');
        const updated = await tx.serviceCategory.findFirst({ where });
        if (!updated) throw categoryNotFound();
        const action: OperationalAuditAction = input.active === false && current.active ? 'SERVICE_CATEGORY_ARCHIVED'
          : input.active === true && !current.active ? 'SERVICE_CATEGORY_REACTIVATED' : 'SERVICE_CATEGORY_UPDATED';
        await this.organizations.recordOperationalAudit(tx, {
          organizationId: context.organizationId, actorUserId: context.userId, action,
          targetId: updated.id, changedFields: auditFields(input),
        });
        return serviceCategoryDto(updated);
      });
    } catch (error) {
      if (categoryNameConflict(error)) throw new ApiError(409, 'SERVICE_CATEGORY_NAME_TAKEN', 'Ya existe una categoría con ese nombre.');
      throw error;
    }
  }

  async list(context: TenantContext, query: ServiceListQueryDto) {
    if (query.categoryId) {
      const category = await this.db.serviceCategory.findFirst({ where: { id: query.categoryId, organizationId: context.organizationId } });
      if (!category) throw categoryNotFound();
    }
    const q = query.q === undefined ? undefined : escapeLikePattern(query.q);
    const rows = await this.db.service.findMany({
      where: {
        organizationId: context.organizationId,
        ...activeFilter(query.status) as Prisma.ServiceWhereInput,
        ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
        ...(query.staffSelectionMode === undefined ? {} : { staffSelectionMode: query.staffSelectionMode }),
        ...(q === undefined ? {} : { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ] }),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: query.offset,
      take: query.limit + 1,
    });
    return { items: rows.slice(0, query.limit).map(serviceDto), pageInfo: pageInfo(query, rows.length) };
  }

  async get(context: TenantContext, serviceId: string) {
    const service = await this.db.service.findFirst({ where: { id: serviceId, organizationId: context.organizationId } });
    if (!service) throw serviceNotFound();
    return serviceDto(service);
  }

  async create(context: TenantContext, input: CreateServiceDto) {
    try {
      return await this.db.$transaction(async tx => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId}::uuid FOR UPDATE`;
        if (!locked.length) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
        const organization = await tx.organization.findUnique({ where: { id: context.organizationId }, select: { currency: true } });
        if (!organization) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
        const price = validatePrice(input.pricingType, input.price, organization.currency);
        if (input.categoryId) {
          const category = await tx.serviceCategory.findFirst({ where: { id: input.categoryId, organizationId: context.organizationId } });
          if (!category) throw categoryNotFound();
          if (!category.active) throw new ApiError(409, 'RELATED_ENTITY_INACTIVE', 'No podés asignar una categoría inactiva.');
        }
        const now = this.clock.now();
        const service = await tx.service.create({ data: {
          organizationId: context.organizationId, name: input.name, nameKey: nameKey(input.name),
          description: input.description ?? null, durationMinutes: input.durationMinutes,
          pricingType: input.pricingType, price, currency: organization.currency,
          categoryId: input.categoryId ?? null, active: true, sortOrder: input.sortOrder,
          staffSelectionMode: input.staffSelectionMode, modality: input.modality,
          version: 1, createdAt: now, updatedAt: now,
        } });
        await this.organizations.recordOperationalAudit(tx, {
          organizationId: context.organizationId, actorUserId: context.userId,
          action: 'SERVICE_CREATED', targetId: service.id, changedFields: auditFields(input),
        });
        return serviceDto(service);
      });
    } catch (error) {
      if (serviceNameConflict(error)) throw new ApiError(409, 'SERVICE_NAME_TAKEN', 'Ya existe un servicio con ese nombre.');
      throw error;
    }
  }

  async update(context: TenantContext, serviceId: string, input: UpdateServiceDto, ifMatch: string | undefined) {
    const version = parseIfMatch(ifMatch);
    try {
      return await this.db.$transaction(async tx => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Organization" WHERE "id" = ${context.organizationId}::uuid FOR UPDATE`;
        if (!locked.length) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
        const organization = await tx.organization.findUnique({ where: { id: context.organizationId }, select: { currency: true } });
        if (!organization) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.');
        const where = { id: serviceId, organizationId: context.organizationId };
        const current = await tx.service.findFirst({ where });
        if (!current) throw serviceNotFound();
        if (current.version !== version) throw versionConflict('servicio');
        const pricingType = input.pricingType ?? current.pricingType;
        const effectivePrice = input.price !== undefined ? input.price : current.price?.toFixed(2) ?? null;
        const price = validatePrice(pricingType, effectivePrice, organization.currency);
        const categoryId = input.categoryId !== undefined ? input.categoryId : current.categoryId;
        if (categoryId && categoryId !== current.categoryId) {
          const category = await tx.serviceCategory.findFirst({ where: { id: categoryId, organizationId: context.organizationId } });
          if (!category) throw categoryNotFound();
          if (!category.active) throw new ApiError(409, 'RELATED_ENTITY_INACTIVE', 'No podés asignar una categoría inactiva.');
        }
        const data: Prisma.ServiceUncheckedUpdateManyInput = {
          version: { increment: 1 }, updatedAt: this.clock.now(), price, pricingType,
        };
        if (input.name !== undefined) { data.name = input.name; data.nameKey = nameKey(input.name); }
        if (input.description !== undefined) data.description = input.description;
        if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes;
        if (input.categoryId !== undefined) data.categoryId = categoryId;
        if (input.active !== undefined) data.active = input.active;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
        if (input.staffSelectionMode !== undefined) data.staffSelectionMode = input.staffSelectionMode;
        if (input.modality !== undefined) data.modality = input.modality;
        data.currency = organization.currency;
        const changed = await tx.service.updateMany({ where: { ...where, version }, data });
        if (changed.count !== 1) throw versionConflict('servicio');
        const updated = await tx.service.findFirst({ where });
        if (!updated) throw serviceNotFound();
        const action: OperationalAuditAction = input.active === false && current.active ? 'SERVICE_ARCHIVED'
          : input.active === true && !current.active ? 'SERVICE_REACTIVATED' : 'SERVICE_UPDATED';
        await this.organizations.recordOperationalAudit(tx, {
          organizationId: context.organizationId, actorUserId: context.userId, action,
          targetId: updated.id, changedFields: auditFields(input),
        });
        return serviceDto(updated);
      });
    } catch (error) {
      if (serviceNameConflict(error)) throw new ApiError(409, 'SERVICE_NAME_TAKEN', 'Ya existe un servicio con ese nombre.');
      throw error;
    }
  }
}
