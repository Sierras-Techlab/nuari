import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { ApiError } from '../common/errors.js';
import type { AuthRequest } from '../common/request.js';
import { Clock } from '../common/clock.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { hasBusinessPermission } from '../subscriptions/subscription.policy.js';
import { OrganizationsService } from './organizations.service.js';

export type TenantMember = Awaited<ReturnType<OrganizationsService['resolveMember']>>;
export type TenantRequest = AuthRequest & { tenant?: TenantMember };
export const RequirePermission = (permission: 'business:access') => SetMetadata('nuari:permission', permission);

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly organizations: OrganizationsService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const id = request.params.id;
    if (typeof id !== 'string' || !isUUID(id)) throw new ApiError(400, 'VALIDATION_ERROR', 'El identificador no es válido.', { id: ['Usá un UUID válido.'] });
    request.tenant = await this.organizations.resolveMember(request.principal!.userId, id);
    return true;
  }
}
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const permission = this.reflector.getAllAndOverride<string>('nuari:permission', [context.getHandler(), context.getClass()]);
    if (permission === 'business:access' && (!request.tenant || !hasBusinessPermission(request.tenant.role))) throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para esta operación.');
    return true;
  }
}
@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(private readonly subscriptions: SubscriptionsService, private readonly clock: Clock) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const member = request.tenant!;
    const state = await this.subscriptions.state(member.organizationId, member.role, this.clock.now());
    if (!state.access.businessAllowed) throw new ApiError(403, 'SUBSCRIPTION_REQUIRED', 'La organización no tiene una suscripción vigente.');
    return true;
  }
}
