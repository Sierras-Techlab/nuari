import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { ServiceCategoriesController } from './service-categories.controller.js';
import { ServiceCatalogService } from './service-catalog.service.js';
import { ServicesController } from './services.controller.js';

@Module({
  imports: [OrganizationsModule, SubscriptionsModule],
  controllers: [ServiceCategoriesController, ServicesController],
  providers: [ServiceCatalogService],
  exports: [ServiceCatalogService],
})
export class ServiceCatalogModule {}
