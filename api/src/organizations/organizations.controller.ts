import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { isUUID } from 'class-validator';
import { Clock } from '../common/clock.js';
import { ApiError } from '../common/errors.js';
import { RateLimiter } from '../common/rate-limiter.js';
import type { AuthRequest } from '../common/request.js';
import { Public } from '../identity/public.decorator.js';
import { ActiveOrganizationDto } from '../identity/identity.dto.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { CreateInvitationDto, CreateOrganizationDto, UpdateMemberRoleDto, UpdateOrganizationDto } from './organizations.dto.js';
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
  @Get(':id') @UseGuards(TenantGuard)
  async getSettings(@Req() request: TenantRequest) {
    const member = request.tenant!;
    return {
      organization: organizationDto(member.organization),
      membership: membershipDto(member),
    };
  }
  @Patch(':id') @UseGuards(TenantGuard)
  async updateSettings(@Body() input: UpdateOrganizationDto, @Req() request: TenantRequest) {
    const member = request.tenant!;
    const organization = await this.organizations.updateSettings(
      member,
      request.principal!.userId,
      input,
    );
    return {
      organization,
      membership: membershipDto(member),
    };
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
  @Get(':id/members') @UseGuards(TenantGuard)
  async listMembers(@Req() request: TenantRequest) {
    return this.organizations.listMembers(request.tenant!.organizationId);
  }
  @Patch(':id/members/:memberId') @UseGuards(TenantGuard)
  async updateMemberRole(
    @Param('memberId') memberId: string,
    @Body() input: UpdateMemberRoleDto,
    @Req() request: TenantRequest,
  ) {
    if (!isUUID(memberId)) throw new ApiError(400, 'VALIDATION_ERROR', 'El identificador de miembro no es válido.');
    return this.organizations.updateMemberRole(request.tenant!, request.principal!.userId, memberId, input);
  }
  @Delete(':id/members/:memberId') @UseGuards(TenantGuard)
  async removeMember(
    @Param('memberId') memberId: string,
    @Req() request: TenantRequest,
  ) {
    if (!isUUID(memberId)) throw new ApiError(400, 'VALIDATION_ERROR', 'El identificador de miembro no es válido.');
    return this.organizations.removeMember(request.tenant!, request.principal!.userId, memberId);
  }
  @Get(':id/invitations') @UseGuards(TenantGuard)
  async listInvitations(@Req() request: TenantRequest) {
    return this.organizations.listInvitations(request.tenant!.organizationId);
  }
  @Post(':id/invitations') @UseGuards(TenantGuard)
  async createInvitation(
    @Body() input: CreateInvitationDto,
    @Req() request: TenantRequest,
  ) {
    return this.organizations.createInvitation(request.tenant!, request.principal!.userId, input);
  }
  @Delete(':id/invitations/:invitationId') @UseGuards(TenantGuard)
  async revokeInvitation(
    @Param('invitationId') invitationId: string,
    @Req() request: TenantRequest,
  ) {
    if (!isUUID(invitationId)) throw new ApiError(400, 'VALIDATION_ERROR', 'El identificador de invitación no es válido.');
    return this.organizations.revokeInvitation(request.tenant!, request.principal!.userId, invitationId);
  }
}

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Public()
  @Get(':token')
  async getInvitation(@Param('token') token: string) {
    if (typeof token !== 'string' || token.length < 16) {
      throw new ApiError(400, 'INVALID_INVITATION', 'El token de invitación no es válido.');
    }
    return this.organizations.getInvitationByToken(token);
  }

  @Post(':token/accept')
  async acceptInvitation(
    @Param('token') token: string,
    @Req() request: AuthRequest,
  ) {
    if (typeof token !== 'string' || token.length < 16) {
      throw new ApiError(400, 'INVALID_INVITATION', 'El token de invitación no es válido.');
    }
    return this.organizations.acceptInvitation(token, request.principal!);
  }
}


