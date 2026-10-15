import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../common/errors.js';
import { RateLimiter } from '../common/rate-limiter.js';
import { hashManagementToken } from './management-token.js';
import { Public } from '../identity/public.decorator.js';
import { BusinessAccessGuard, PermissionGuard, RequirePermission, TenantGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import { PublicBookingService } from './public-booking.service.js';
import {
  PublicAvailabilityQueryDto, PublicCancelDto, PublicCreateAppointmentDto, PublicManageTokenDto, PublicRescheduleAvailabilityDto,
  PublicRescheduleDto, PublicStaffQueryDto, RevokeManagementLinkDto,
} from './public-booking.dto.js';

function ip(request: Request): string { return request.ip || request.socket.remoteAddress || 'unknown'; }

@Controller('public/booking/:slug')
export class PublicBookingController {
  constructor(private readonly booking: PublicBookingService, private readonly rate: RateLimiter) {}

  @Get('catalog')
  @Public()
  async catalog(@Param('slug') slug: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.rate.consume('public-booking-catalog', `${slug}:${ip(request)}`, 60, 60_000);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return this.booking.catalog(slug);
  }

  @Get('services/:serviceId/staff')
  @Public()
  async staff(@Param('slug') slug: string, @Param('serviceId') serviceId: string, @Query() query: PublicStaffQueryDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.rate.consume('public-booking-catalog', `${slug}:${ip(request)}`, 60, 60_000);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return this.booking.listPublicStaff(slug, serviceId, query.offset);
  }

  @Get('availability')
  @Public()
  async availability(@Param('slug') slug: string, @Query() query: PublicAvailabilityQueryDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.rate.consume('public-booking-availability', `${slug}:${ip(request)}`, 30, 60_000);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return this.booking.findAvailability(slug, query);
  }

  @Post('appointments')
  @Public()
  async create(@Param('slug') slug: string, @Body() body: PublicCreateAppointmentDto, @Headers('idempotency-key') key: string | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new ApiError(400, 'VALIDATION_ERROR', 'Idempotency-Key debe ser un UUID v4.');
    const address = ip(request);
    await this.rate.consume('public-booking-create-ip', `${slug}:${address}`, 5, 10 * 60_000);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return this.booking.create(slug, key, body);
  }

  @Post('manage/resolve')
  @Public()
  async resolve(@Param('slug') slug: string, @Body() body: PublicManageTokenDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.manageLimit(slug, body.token, request);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return this.booking.resolve(slug, body);
  }

  @Post('manage/:appointmentId/availability')
  @Public()
  async rescheduleAvailability(@Param('slug') slug: string, @Param('appointmentId') appointmentId: string, @Body() body: PublicRescheduleAvailabilityDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.manageLimit(slug, body.token, request);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return this.booking.findRescheduleAvailability(slug, appointmentId, body, ifMatch);
  }

  @Post('manage/:appointmentId/cancel')
  @Public()
  async cancel(@Param('slug') slug: string, @Param('appointmentId') appointmentId: string, @Body() body: PublicCancelDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.manageLimit(slug, body.token, request);
    response.setHeader('Cache-Control', 'no-store');
    return this.booking.cancel(slug, appointmentId, body, ifMatch);
  }

  @Post('manage/:appointmentId/reschedule')
  @Public()
  async reschedule(@Param('slug') slug: string, @Param('appointmentId') appointmentId: string, @Body() body: PublicRescheduleDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.manageLimit(slug, body.token, request);
    response.setHeader('Cache-Control', 'no-store');
    return this.booking.reschedule(slug, appointmentId, body, ifMatch);
  }

  private async manageLimit(slug: string, token: string, request: Request) {
    const digest = hashManagementToken(token);
    await this.rate.consume('public-booking-manage', `${slug}:${ip(request)}:${digest}`, 20, 10 * 60_000);
  }
}

@Controller('organizations/:id/appointments/:appointmentId/management-link')
@UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
@RequirePermission('scheduling:manage')
export class ManagementLinkController {
  constructor(private readonly booking: PublicBookingService) {}

  @Post('revoke')
  async revoke(@Param('appointmentId') appointmentId: string, @Body() input: RevokeManagementLinkDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.booking.revoke(this.context(request), appointmentId, ifMatch, input);
    response.setHeader('ETag', `"${result.version}"`);
    return result;
  }

  private context(request: TenantRequest) {
    const member = request.tenant!;
    return { userId: member.userId, organizationId: member.organizationId, membershipId: member.id, role: member.role };
  }
}
