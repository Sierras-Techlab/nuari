import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { BusinessAccessGuard, PermissionGuard, RequirePermission, TenantGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import { AvailabilityQueryDto } from './availability.dto.js';
import { AvailabilityService } from './availability.service.js';

@Controller('organizations/:id/availability')
@UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
@RequirePermission('scheduling:read')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  find(@Query() query: AvailabilityQueryDto, @Req() request: TenantRequest) {
    return this.availability.find({ organizationId: request.tenant!.organizationId }, query);
  }
}
