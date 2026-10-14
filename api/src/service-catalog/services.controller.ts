import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from '../common/errors.js';
import { RequirePermission, tenantContext, TenantGuard, PermissionGuard, BusinessAccessGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import { CreateServiceDto, ServiceListQueryDto, UpdateServiceDto } from './services.dto.js';
import { ServiceCatalogService } from './service-catalog.service.js';

function setEtag(response: Response, version: number): void {
  response.setHeader('ETag', `"${version}"`);
}

@Controller('organizations/:id/services')
export class ServicesController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:read')
  list(@Query() query: ServiceListQueryDto, @Req() request: TenantRequest) {
    return this.catalog.list(tenantContext(request.tenant!), query);
  }

  @Post()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:manage')
  async create(@Body() input: CreateServiceDto, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const service = await this.catalog.create(tenantContext(request.tenant!), input);
    setEtag(response, service.version);
    response.status(201);
    return service;
  }

  @Get(':serviceId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:read')
  async get(@Param('serviceId', ParseUUIDPipe) serviceId: string, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const service = await this.catalog.get(tenantContext(request.tenant!), serviceId);
    setEtag(response, service.version);
    return service;
  }

  @Patch(':serviceId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:manage')
  async update(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() input: UpdateServiceDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const fields = ['name', 'description', 'durationMinutes', 'pricingType', 'price', 'categoryId', 'sortOrder', 'staffSelectionMode', 'modality', 'active'];
    if (!fields.some(field => Object.hasOwn(request.body as object, field))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá al menos un campo para modificar.');
    }
    const service = await this.catalog.update(tenantContext(request.tenant!), serviceId, input, ifMatch);
    setEtag(response, service.version);
    return service;
  }
}
