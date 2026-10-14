import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from '../common/errors.js';
import { RequirePermission, tenantContext, TenantGuard, PermissionGuard, BusinessAccessGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import { CreateStaffMemberDto, StaffListQueryDto, UpdateStaffMemberDto } from './staff.dto.js';
import { StaffService } from './staff.service.js';

function setEtag(response: Response, version: number): void {
  response.setHeader('ETag', `"${version}"`);
}

@Controller('organizations/:id/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('staff:read')
  list(@Query() query: StaffListQueryDto, @Req() request: TenantRequest) {
    return this.staff.list(tenantContext(request.tenant!), query);
  }

  @Post()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('staff:manage')
  async create(@Body() input: CreateStaffMemberDto, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const staff = await this.staff.create(tenantContext(request.tenant!), input);
    setEtag(response, staff.version);
    response.status(201);
    return staff;
  }

  @Get(':staffMemberId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('staff:manage')
  async get(@Param('staffMemberId', ParseUUIDPipe) staffMemberId: string, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const staff = await this.staff.get(tenantContext(request.tenant!), staffMemberId);
    setEtag(response, staff.version);
    return staff;
  }

  @Patch(':staffMemberId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('staff:manage')
  async update(
    @Param('staffMemberId', ParseUUIDPipe) staffMemberId: string,
    @Body() input: UpdateStaffMemberDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!['name', 'email', 'phone', 'active'].some(field => Object.hasOwn(request.body as object, field))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá al menos un campo para modificar.');
    }
    const staff = await this.staff.update(tenantContext(request.tenant!), staffMemberId, input, ifMatch);
    setEtag(response, staff.version);
    return staff;
  }
}
