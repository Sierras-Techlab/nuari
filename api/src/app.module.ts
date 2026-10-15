import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { ServiceCatalogModule } from './service-catalog/service-catalog.module.js';
import { StaffModule } from './staff/staff.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { PublicBookingModule } from './public-booking/public-booking.module.js';

@Module({
  imports: [DatabaseModule, IdentityModule, OrganizationsModule, SubscriptionsModule, CustomersModule, ServiceCatalogModule, StaffModule, AvailabilityModule, AppointmentsModule, PublicBookingModule],
  controllers: [AppController],
})
export class AppModule {}
