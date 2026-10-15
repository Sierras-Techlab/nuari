import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { SchedulingReadModule } from '../availability/scheduling-read.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentLifecycleService } from './appointment-lifecycle.service.js';

@Module({
  imports: [CustomersModule, OrganizationsModule, ServiceCatalogModule, StaffModule, SchedulingReadModule, SubscriptionsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentLifecycleService],
  exports: [AppointmentsService, AppointmentLifecycleService],
})
export class AppointmentsModule {}
