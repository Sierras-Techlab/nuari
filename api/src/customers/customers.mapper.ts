import type { Customer } from '../generated/prisma/client.js';
import type { TenantContext } from '../organizations/tenant.guard.js';

export function customerSummaryDto(customer: Customer) {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    active: customer.active,
    version: customer.version,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function customerDetailDto(customer: Customer, context: Pick<TenantContext, 'role'>) {
  return {
    ...customerSummaryDto(customer),
    ...(context.role === 'OWNER' || context.role === 'ADMIN' ? { notes: customer.notes } : {}),
  };
}
