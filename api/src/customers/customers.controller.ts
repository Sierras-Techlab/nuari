import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from '../common/errors.js';
import type { TenantRequest } from '../organizations/tenant.guard.js';
import { tenantContext, TenantGuard, PermissionGuard, BusinessAccessGuard, RequirePermission } from '../organizations/tenant.guard.js';
import { hasPermission } from '../organizations/organization-permissions.js';
import { CreateCustomerDto, CustomerListQueryDto, DuplicateCustomerCandidatesQueryDto, UpdateCustomerDto } from './customers.dto.js';
import { CustomersService } from './customers.service.js';

function requireFieldPermission(request: TenantRequest, field: 'notes' | 'active'): void {
  const permission = field === 'notes' ? 'customers:notes' : 'customers:archive';
  if (!hasPermission(request.tenant!.role, permission)) {
    throw new ApiError(403, 'PERMISSION_DENIED', 'No tenés permiso para modificar este campo.');
  }
}

function inputHasField(request: TenantRequest, field: string): boolean {
  return typeof request.body === 'object' && request.body !== null && Object.hasOwn(request.body, field);
}

function setEtag(response: Response, version: number): void {
  response.setHeader('ETag', `"${version}"`);
}

@Controller('organizations/:id/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('duplicate-candidates')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('customers:read')
  duplicateCandidates(
    @Query() query: DuplicateCustomerCandidatesQueryDto,
    @Req() request: TenantRequest,
  ) {
    return this.customers.duplicateCandidates(tenantContext(request.tenant!), query);
  }

  @Get()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('customers:read')
  list(@Query() query: CustomerListQueryDto, @Req() request: TenantRequest) {
    return this.customers.list(tenantContext(request.tenant!), query);
  }

  @Post()
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('customers:create')
  async create(
    @Body() input: CreateCustomerDto,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (inputHasField(request, 'notes')) requireFieldPermission(request, 'notes');
    const customer = await this.customers.create(tenantContext(request.tenant!), input);
    setEtag(response, customer.version);
    response.status(201);
    return customer;
  }

  @Get(':customerId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('customers:read')
  async get(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const customer = await this.customers.get(tenantContext(request.tenant!), customerId);
    setEtag(response, customer.version);
    return customer;
  }

  @Patch(':customerId')
  @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
  @RequirePermission('customers:update')
  async update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() input: UpdateCustomerDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!['name', 'phone', 'email', 'notes', 'active'].some(field => inputHasField(request, field))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá al menos un campo para modificar.');
    }
    if (inputHasField(request, 'notes')) requireFieldPermission(request, 'notes');
    if (inputHasField(request, 'active')) requireFieldPermission(request, 'active');
    const customer = await this.customers.update(tenantContext(request.tenant!), customerId, input, ifMatch);
    setEtag(response, customer.version);
    return customer;
  }
}
