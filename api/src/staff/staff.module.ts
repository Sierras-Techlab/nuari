import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { StaffController } from './staff.controller.js';
import { StaffServicesController } from './staff-services.controller.js';
import { StaffService } from './staff.service.js';
import { StaffServicesService } from './staff-services.service.js';

@Module({
  imports: [OrganizationsModule, ServiceCatalogModule, SubscriptionsModule],
  controllers: [StaffController, StaffServicesController],
  providers: [StaffService, StaffServicesService],
})
export class StaffModule {}
