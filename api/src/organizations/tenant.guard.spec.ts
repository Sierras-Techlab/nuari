import { describe, expect, it, vi } from 'vitest';
import { TenantGuard } from './tenant.guard.js';

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
