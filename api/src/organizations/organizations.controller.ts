import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { isUUID } from 'class-validator';
import { Clock } from '../common/clock.js';
import { ApiError } from '../common/errors.js';
import { RateLimiter } from '../common/rate-limiter.js';
import type { AuthRequest } from '../common/request.js';
import { ActiveOrganizationDto } from '../identity/identity.dto.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { CreateOrganizationDto } from './organizations.dto.js';
import { membershipDto, organizationDto, OrganizationsService } from './organizations.service.js';
import { BusinessAccessGuard, PermissionGuard, RequirePermission, TenantGuard, type TenantRequest } from './tenant.guard.js';

@Controller('auth')
export class AccessContextController {
  constructor(private readonly organizations: OrganizationsService) {}
  @Get('me')
  me(@Req() request: AuthRequest) { return this.organizations.snapshot(request.principal!); }
  @Post('active-organization') @HttpCode(200)
  select(@Body() input: ActiveOrganizationDto, @Req() request: AuthRequest) { return this.organizations.snapshot(request.principal!, input.organizationId); }
}
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService, private readonly subscriptions: SubscriptionsService, private readonly rate: RateLimiter, private readonly clock: Clock) {}
  @Post()
  async create(@Body() input: CreateOrganizationDto, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const key = request.get('idempotency-key');
    if (!key || !isUUID(key)) throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Usá una clave de idempotencia UUID.');
    await this.rate.consume('onboarding:user', request.principal!.userId, 3, 3_600_000);
    const { replay, ...result } = await this.organizations.createInitial(request.principal!, key, input);
    response.status(replay ? 200 : 201);
    return result;
  }
  @Get(':id/subscription') @UseGuards(TenantGuard)
  subscription(@Req() request: TenantRequest) { return this.subscriptions.state(request.tenant!.organizationId, request.tenant!.role, this.clock.now()); }
  @Get(':id/workspace') @UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard) @RequirePermission('business:access')
  async workspace(@Req() request: TenantRequest) {
    const member = request.tenant!;
    const now = this.clock.now();
    const state = await this.subscriptions.state(member.organizationId, member.role, now);
    if (!state.access.businessAllowed) throw new ApiError(403, 'SUBSCRIPTION_REQUIRED', 'La organización no tiene una suscripción vigente.');
    return { organization: organizationDto(member.organization), membership: membershipDto(member), access: state.access, evaluatedAt: now.toISOString() };
  }
}
