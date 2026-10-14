import { describe, expect, it } from 'vitest';
import { hasPermission, type Permission } from './organization-permissions.js';

const permissions: Permission[] = [
  'customers:read',
  'customers:create',
  'customers:update',
  'customers:archive',
  'customers:notes',
  'services:read',
  'services:manage',
  'staff:read',
  'staff:manage',
];

describe('hasPermission', () => {
  it.each(['OWNER', 'ADMIN'] as const)('grants the approved operational permissions to %s', role => {
    for (const permission of permissions) expect(hasPermission(role, permission)).toBe(true);
  });

  it('grants EMPLOYEE only approved read and customer write permissions', () => {
    const allowed: Permission[] = ['customers:read', 'customers:create', 'customers:update', 'services:read', 'staff:read'];
    for (const permission of permissions) expect(hasPermission('EMPLOYEE', permission)).toBe(allowed.includes(permission));
  });

  it('denies permissions that are not part of the closed permission set', () => {
    expect(hasPermission('OWNER', 'customers:admin')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'unknown:permission')).toBe(false);
  });

  it.each(['OWNER', 'ADMIN', 'EMPLOYEE'] as const)('preserves business access for %s through the existing subscription policy', role => {
    expect(hasPermission(role, 'business:access')).toBe(true);
  });
});
