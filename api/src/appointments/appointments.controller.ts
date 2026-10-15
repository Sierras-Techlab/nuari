import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { BusinessAccessGuard, PermissionGuard, RequirePermission, TenantGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import { ApiError } from '../common/errors.js';
import { CreateAppointmentDto } from './appointments.dto.js';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentLifecycleService } from './appointment-lifecycle.service.js';
import { AppointmentListQueryDto, AppointmentTransitionDto, CorrectAppointmentDto } from './appointments.dto.js';
import { RescheduleAppointmentDto } from './appointments.dto.js';

@Controller('organizations/:id/appointments')
@UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
@RequirePermission('scheduling:book')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService, private readonly lifecycle: AppointmentLifecycleService) {}

  @Get()
  @RequirePermission('scheduling:read')
  list(@Query() query: AppointmentListQueryDto, @Req() request: TenantRequest) {
    return this.lifecycle.list(this.context(request), query);
  }

  @Get(':appointmentId/events')
  @RequirePermission('scheduling:manage')
  events(@Param('appointmentId') appointmentId: string, @Req() request: TenantRequest) {
    return this.lifecycle.events(this.context(request), appointmentId);
  }

  @Get(':appointmentId')
  @RequirePermission('scheduling:read')
  get(@Param('appointmentId') appointmentId: string, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    return this.lifecycle.get(this.context(request), appointmentId).then(result => {
      response.setHeader('ETag', `"${result.version}"`);
      return result;
    });
  }

  @Post()
  create(@Body() body: CreateAppointmentDto, @Headers('idempotency-key') key: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Idempotency-Key debe ser un UUID v4.');
    }
    return this.appointments.createInternal(this.context(request), key, body).then(result => {
      response.setHeader('ETag', `"${result.version}"`);
      return result;
    });
  }

  @Post(':appointmentId/cancel')
  @RequirePermission('scheduling:book')
  cancel(@Param('appointmentId') appointmentId: string, @Body() body: AppointmentTransitionDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    return this.lifecycle.cancel(this.context(request), appointmentId, ifMatch, body).then(result => {
      response.setHeader('ETag', `"${result.version}"`);
      return result;
    });
  }

  @Post(':appointmentId/complete')
  @RequirePermission('scheduling:manage')
  complete(@Param('appointmentId') appointmentId: string, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    return this.lifecycle.close(this.context(request), appointmentId, ifMatch, 'COMPLETED').then(result => {
      response.setHeader('ETag', `"${result.version}"`);
      return result;
    });
  }

  @Post(':appointmentId/no-show')
  @RequirePermission('scheduling:manage')
  noShow(@Param('appointmentId') appointmentId: string, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    return this.lifecycle.close(this.context(request), appointmentId, ifMatch, 'NO_SHOW').then(result => {
      response.setHeader('ETag', `"${result.version}"`);
      return result;
    });
  }

  @Post(':appointmentId/correct')
  @RequirePermission('scheduling:manage')
  correct(@Param('appointmentId') appointmentId: string, @Body() body: CorrectAppointmentDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    return this.lifecycle.correct(this.context(request), appointmentId, ifMatch, body).then(result => {
      response.setHeader('ETag', `"${result.version}"`);
      return result;
    });
  }

  @Post(':appointmentId/reschedule')
  @RequirePermission('scheduling:book')
  reschedule(@Param('appointmentId') appointmentId: string, @Body() body: RescheduleAppointmentDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    return this.lifecycle.reschedule(this.context(request), appointmentId, ifMatch, body).then(result => {
      response.setHeader('ETag', `"${result.version}"`);
      return result;
    });
  }

  private context(request: TenantRequest) {
    const member = request.tenant!;
    return { userId: member.userId, organizationId: member.organizationId, membershipId: member.id, role: member.role };
  }
}
