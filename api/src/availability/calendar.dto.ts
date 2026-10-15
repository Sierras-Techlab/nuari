import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsString,
  Length, Matches, Max, Min, ValidateIf, ValidateNested,
} from 'class-validator';

export class PatchSchedulingSettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  publicBookingEnabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([5, 10, 15, 30])
  slotStepMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt() @Min(0) @Max(43_200)
  publicMinNoticeMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt() @Min(1) @Max(365)
  publicMaxAdvanceDays?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt() @Min(0) @Max(43_200)
  publicCancelNoticeMinutes?: number;
}

export class CalendarWindowDto {
  @IsInt() @Min(0) @Max(1439)
  startMinute: number;

  @IsInt() @Min(1) @Max(1440)
  endMinute: number;
}

export class WeeklyCalendarWindowDto extends CalendarWindowDto {
  @IsInt() @Min(1) @Max(7)
  weekday: number;
}

export class ReplaceWeeklyWindowsDto {
  @IsArray() @ArrayMaxSize(28)
  @ValidateNested({ each: true }) @Type(() => WeeklyCalendarWindowDto)
  windows: WeeklyCalendarWindowDto[];
}

export class ReplaceOverrideWindowsDto {
  @IsArray() @ArrayMaxSize(28)
  @ValidateNested({ each: true }) @Type(() => CalendarWindowDto)
  windows: CalendarWindowDto[];
}

export class CreateBookingCalendarDto {
  @IsIn(['BUSINESS', 'STAFF'])
  kind: 'BUSINESS' | 'STAFF';

  @ValidateIf((_object, value) => value !== undefined)
  @IsString() @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  staffMemberId?: string;
}

export class CreateCalendarTimeOffDto {
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startAt: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endAt: string;

  @IsString() @Length(1, 40)
  @IsIn(['BUSINESS_CLOSED', 'STAFF_ABSENCE', 'OTHER'])
  reasonCode: string;
}
