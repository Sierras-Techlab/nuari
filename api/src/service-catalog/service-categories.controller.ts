import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from '../common/errors.js';
import { RequirePermission, tenantContext, TenantGuard, PermissionGuard, BusinessAccessGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import { CreateServiceCategoryDto, ServiceCategoryListQueryDto, UpdateServiceCategoryDto } from './service-categories.dto.js';
import { ServiceCatalogService } from './service-catalog.service.js';

function setEtag(response: Response, version: number): void {
  response.setHeader('ETag', `"${version}"`);
}

@Controller('organizations/:id/service-categories')
export class ServiceCategoriesController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:read')
  list(@Query() query: ServiceCategoryListQueryDto, @Req() request: TenantRequest) {
    return this.catalog.listCategories(tenantContext(request.tenant!), query);
  }

  @Post()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:manage')
  async create(@Body() input: CreateServiceCategoryDto, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const category = await this.catalog.createCategory(tenantContext(request.tenant!), input);
    setEtag(response, category.version);
    response.status(201);
    return category;
  }

  @Get(':categoryId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:read')
  async get(@Param('categoryId', ParseUUIDPipe) categoryId: string, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const category = await this.catalog.getCategory(tenantContext(request.tenant!), categoryId);
    setEtag(response, category.version);
    return category;
  }

  @Patch(':categoryId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('services:manage')
  async update(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() input: UpdateServiceCategoryDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!['name', 'sortOrder', 'active'].some(field => Object.hasOwn(request.body as object, field))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá al menos un campo para modificar.');
    }
    const category = await this.catalog.updateCategory(tenantContext(request.tenant!), categoryId, input, ifMatch);
    setEtag(response, category.version);
    return category;
  }
}
