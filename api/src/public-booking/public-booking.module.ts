import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { AvailabilityModule } from '../availability/availability.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { PublicBookingController, ManagementLinkController } from './public-booking.controller.js';
import { PublicBookingService } from './public-booking.service.js';

@Module({
  imports: [AppointmentsModule, AvailabilityModule, OrganizationsModule, SubscriptionsModule],
  controllers: [PublicBookingController, ManagementLinkController],
  providers: [PublicBookingService],
})
export class PublicBookingModule {}
