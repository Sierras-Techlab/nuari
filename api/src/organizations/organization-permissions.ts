import type { OrganizationRole } from '../generated/prisma/client.js';
import { hasBusinessPermission } from '../subscriptions/subscription.policy.js';

export type Permission =
  | 'business:access'
  | 'customers:read'
  | 'customers:create'
  | 'customers:update'
  | 'customers:archive'
  | 'customers:notes'
  | 'services:read'
  | 'services:manage'
  | 'staff:read'
  | 'staff:manage'
  | 'scheduling:read'
  | 'scheduling:book'
  | 'scheduling:manage';

const rolePermissions: Record<OrganizationRole, ReadonlySet<Permission>> = {
  OWNER: new Set([
    'customers:read', 'customers:create', 'customers:update', 'customers:archive', 'customers:notes',
    'services:read', 'services:manage',
    'staff:read', 'staff:manage',
    'scheduling:read', 'scheduling:book', 'scheduling:manage',
  ]),
  ADMIN: new Set([
    'customers:read', 'customers:create', 'customers:update', 'customers:archive', 'customers:notes',
    'services:read', 'services:manage',
    'staff:read', 'staff:manage',
    'scheduling:read', 'scheduling:book', 'scheduling:manage',
  ]),
  EMPLOYEE: new Set([
    'customers:read', 'customers:create', 'customers:update',
    'services:read', 'staff:read', 'scheduling:read', 'scheduling:book',
  ]),
};

export function hasPermission(role: OrganizationRole, permission: string): boolean {
  if (permission === 'business:access') return hasBusinessPermission(role);
  return rolePermissions[role]?.has(permission as Permission) ?? false;
}
