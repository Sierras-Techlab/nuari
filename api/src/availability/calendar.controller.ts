import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { isUUID } from 'class-validator';
import { ApiError } from '../common/errors.js';
import { parseIfMatch } from '../common/if-match.js';
import { BusinessAccessGuard, PermissionGuard, RequirePermission, TenantGuard, type TenantRequest } from '../organizations/tenant.guard.js';
import {
  CreateBookingCalendarDto, CreateCalendarTimeOffDto, PatchSchedulingSettingsDto,
  ReplaceOverrideWindowsDto, ReplaceWeeklyWindowsDto,
} from './calendar.dto.js';
import { CalendarService } from './calendar.service.js';

@Controller('organizations/:id/scheduling')
@UseGuards(TenantGuard, PermissionGuard, BusinessAccessGuard)
@RequirePermission('scheduling:read')
export class CalendarController {
  constructor(private readonly calendars: CalendarService) {}

  private assertCalendarId(calendarId: string): void {
    if (!isUUID(calendarId)) throw new ApiError(400, 'VALIDATION_ERROR', 'El identificador del calendario no es válido.');
  }

  @Get('settings')
  async getSettings(@Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.calendars.getSettings({ organizationId: request.tenant!.organizationId });
    response.setHeader('ETag', `"${result.version}"`);
    return result;
  }

  @Patch('settings')
  @RequirePermission('scheduling:manage')
  async updateSettings(@Body() input: PatchSchedulingSettingsDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    const version = parseIfMatch(ifMatch);
    if (Object.keys(input).length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Indicá al menos un campo para actualizar.');
    const result = await this.calendars.updateSettings({ organizationId: request.tenant!.organizationId }, input, version);
    response.setHeader('ETag', `"${result!.version}"`);
    return result;
  }

  @Get('calendars')
  listCalendars(@Req() request: TenantRequest) {
    return this.calendars.listCalendars({ organizationId: request.tenant!.organizationId });
  }

  @Post('calendars')
  @RequirePermission('scheduling:manage')
  createCalendar(@Body() input: CreateBookingCalendarDto, @Req() request: TenantRequest) {
    return this.calendars.createCalendar({ organizationId: request.tenant!.organizationId }, input);
  }

  @Put('calendars/:calendarId/weekly-windows')
  @RequirePermission('scheduling:manage')
  async replaceWeeklyWindows(@Param('calendarId') calendarId: string, @Body() input: ReplaceWeeklyWindowsDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    this.assertCalendarId(calendarId);
    const version = parseIfMatch(ifMatch);
    const result = await this.calendars.replaceWeeklyWindows({ organizationId: request.tenant!.organizationId }, calendarId, input, version);
    response.setHeader('ETag', `"${result.version}"`);
    return result;
  }

  @Put('calendars/:calendarId/overrides/:localDate')
  @RequirePermission('scheduling:manage')
  async replaceDayOverride(@Param('calendarId') calendarId: string, @Param('localDate') localDate: string, @Body() input: ReplaceOverrideWindowsDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    this.assertCalendarId(calendarId);
    const version = parseIfMatch(ifMatch);
    const result = await this.calendars.replaceDayOverride({ organizationId: request.tenant!.organizationId }, calendarId, localDate, input, version);
    response.setHeader('ETag', `"${result.version}"`);
    return result;
  }

  @Post('calendars/:calendarId/time-off')
  @RequirePermission('scheduling:manage')
  async createTimeOff(@Param('calendarId') calendarId: string, @Body() input: CreateCalendarTimeOffDto, @Headers('if-match') ifMatch: string | undefined, @Req() request: TenantRequest, @Res({ passthrough: true }) response: Response) {
    this.assertCalendarId(calendarId);
    const version = parseIfMatch(ifMatch);
    const result = await this.calendars.createTimeOff({ organizationId: request.tenant!.organizationId }, calendarId, input, version);
    response.setHeader('ETag', `"${result.version}"`);
    return result;
  }
}
