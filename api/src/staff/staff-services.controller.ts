import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission, tenantContext, TenantGuard, PermissionGuard, BusinessAccessGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import { PutStaffServiceDto, StaffServiceListQueryDto } from './staff-services.dto.js';
import { StaffServicesService } from './staff-services.service.js';

function setEtag(response: Response, version: number): void {
  response.setHeader('ETag', `"${version}"`);
}

@Controller('organizations/:id')
export class StaffServicesController {
  constructor(private readonly staffServices: StaffServicesService) {}

  @Get('services/:serviceId/staff')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission(['services:read', 'staff:read'])
  listForService(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Query() query: StaffServiceListQueryDto,
    @Req() request: TenantRequest,
  ) {
    return this.staffServices.listForService(tenantContext(request.tenant!), serviceId, query);
  }

  @Get('staff/:staffMemberId/services')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission(['staff:read', 'services:read'])
  listForStaff(
    @Param('staffMemberId', ParseUUIDPipe) staffMemberId: string,
    @Query() query: StaffServiceListQueryDto,
    @Req() request: TenantRequest,
  ) {
    return this.staffServices.listForStaff(tenantContext(request.tenant!), staffMemberId, query);
  }

  @Put('services/:serviceId/staff/:staffMemberId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission(['staff:manage', 'services:manage'])
  async assign(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('staffMemberId', ParseUUIDPipe) staffMemberId: string,
    @Body() _input: PutStaffServiceDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.staffServices.assign(tenantContext(request.tenant!), serviceId, staffMemberId, ifMatch);
    setEtag(response, result.serviceVersion);
    return result;
  }

  @Delete('services/:serviceId/staff/:staffMemberId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission(['staff:manage', 'services:manage'])
  async unassign(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('staffMemberId', ParseUUIDPipe) staffMemberId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.staffServices.unassign(tenantContext(request.tenant!), serviceId, staffMemberId, ifMatch);
    setEtag(response, result.serviceVersion);
    return result;
  }
}
