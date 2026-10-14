import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { OrganizationsService } from './organizations.service.js';
import { AccessContextController, InvitationsController, OrganizationsController } from './organizations.controller.js';
import { BusinessAccessGuard, PermissionGuard, TenantGuard } from './tenant.guard.js';

@Module({
  imports: [IdentityModule, SubscriptionsModule, IntegrationsModule],

  controllers: [AccessContextController, OrganizationsController, InvitationsController],
  providers: [OrganizationsService, TenantGuard, PermissionGuard, BusinessAccessGuard],

  exports: [OrganizationsService, TenantGuard, PermissionGuard, BusinessAccessGuard],
})
export class OrganizationsModule {}
