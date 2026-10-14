import type { Service, ServiceCategory } from '../generated/prisma/client.js';

export function serviceCategoryDto(category: ServiceCategory) {
  return {
    id: category.id,
    organizationId: category.organizationId,
    name: category.name,
    active: category.active,
    sortOrder: category.sortOrder,
    version: category.version,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function serviceDto(service: Service) {
  return {
    id: service.id,
    organizationId: service.organizationId,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    pricingType: service.pricingType,
    price: service.price === null ? null : service.price.toFixed(2),
    currency: service.currency,
    categoryId: service.categoryId,
    active: service.active,
    sortOrder: service.sortOrder,
    staffSelectionMode: service.staffSelectionMode,
    modality: service.modality,
    version: service.version,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}
