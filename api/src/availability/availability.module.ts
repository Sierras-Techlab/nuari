import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { SchedulingReadModule } from './scheduling-read.module.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  imports: [OrganizationsModule, SubscriptionsModule, ServiceCatalogModule, StaffModule, SchedulingReadModule],
  controllers: [CalendarController, AvailabilityController],
  providers: [CalendarService, AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
