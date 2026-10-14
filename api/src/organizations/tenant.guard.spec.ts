import { describe, expect, it, vi } from 'vitest';
import { PermissionGuard, TenantGuard, tenantContext } from './tenant.guard.js';

describe('TenantGuard', () => {
  it('denies a request when the signed-in user has no active tenant membership', async () => {
    const organizations = { resolveMember: vi.fn().mockRejectedValue({ status: 404, response: { code: 'ORGANIZATION_NOT_FOUND' } }) };
    const request = { params: { id: '123e4567-e89b-42d3-a456-426614174000' }, principal: { userId: 'revoked-user' } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };
    const guard = new TenantGuard(organizations as never);

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({ status: 404, response: { code: 'ORGANIZATION_NOT_FOUND' } });
    expect(organizations.resolveMember).toHaveBeenCalledWith('revoked-user', request.params.id);
  });
});

describe('PermissionGuard', () => {
  it('denies an unknown runtime permission instead of letting it pass', () => {
    const request = { tenant: { role: 'OWNER' } };
    const context = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => ({}), getClass: () => ({}) };
    const reflector = { getAllAndOverride: () => 'customers:admin' };
    const guard = new PermissionGuard(reflector as never);

    expect(() => guard.canActivate(context as never)).toThrow(expect.objectContaining({
      status: 403,
      response: expect.objectContaining({ code: 'PERMISSION_DENIED' }),
    }));
  });

  it('preserves business access for every organization role', () => {
    for (const role of ['OWNER', 'ADMIN', 'EMPLOYEE']) {
      const request = { tenant: { role } };
      const context = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => ({}), getClass: () => ({}) };
      const reflector = { getAllAndOverride: () => 'business:access' };
      const guard = new PermissionGuard(reflector as never);
      expect(guard.canActivate(context as never)).toBe(true);
    }
  });

  it('requires every permission when metadata contains a conjunction', () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ tenant: { role: 'EMPLOYEE' } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    const reflector = { getAllAndOverride: () => ['customers:create', 'services:manage'] };
    const guard = new PermissionGuard(reflector as never);

    expect(() => guard.canActivate(context as never)).toThrow(expect.objectContaining({
      status: 403,
      response: expect.objectContaining({ code: 'PERMISSION_DENIED' }),
    }));
  });
});

describe('tenantContext', () => {
  it('projects only the explicit identity and authorization context from the active membership', () => {
    expect(tenantContext({
      id: 'membership-id',
      userId: 'user-id',
      organizationId: 'organization-id',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      organization: { id: 'organization-id', name: 'Private org data' },
    } as never)).toEqual({
      userId: 'user-id',
      organizationId: 'organization-id',
      membershipId: 'membership-id',
      role: 'ADMIN',
    });
  });
});
