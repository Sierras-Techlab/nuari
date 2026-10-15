import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested, Matches } from 'class-validator';

export class AppointmentAssignmentDto {
  @IsIn(['SPECIFIC', 'ANY', 'NONE'])
  kind!: 'SPECIFIC' | 'ANY' | 'NONE';

  @IsOptional()
  @IsUUID('4')
  staffMemberId?: string;
}

export class CreateAppointmentDto {
  @IsUUID('4')
  customerId!: string;

  @IsUUID('4')
  serviceId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;

  @ValidateNested()
  @Type(() => AppointmentAssignmentDto)
  assignment!: AppointmentAssignmentDto;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Matches(/^(?![\s\S]*<\/?[a-z][^>]*>)[\s\S]*$/i)
  internalNotes?: string | null;
}

export class AppointmentListQueryDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string;

  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate!: string;

  @IsOptional() @IsUUID('4')
  staffMemberId?: string;

  @IsOptional() @IsUUID('4')
  customerId?: string;

  @IsOptional() @IsIn(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : value)
  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit = 50;

  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,2048}$/)
  cursor?: string;
}

export class AppointmentTransitionDto {
  @IsIn(['CUSTOMER_REQUEST', 'BUSINESS_REQUEST', 'OTHER'])
  reasonCode!: 'CUSTOMER_REQUEST' | 'BUSINESS_REQUEST' | 'OTHER';
}

export class CorrectAppointmentDto {
  @IsIn(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status!: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

  @IsIn(['DATA_ENTRY_ERROR', 'CUSTOMER_DISPUTE', 'BUSINESS_DISPUTE', 'OTHER'])
  reasonCode!: 'DATA_ENTRY_ERROR' | 'CUSTOMER_DISPUTE' | 'BUSINESS_DISPUTE' | 'OTHER';
}

export class RescheduleAppointmentDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;

  @ValidateNested() @Type(() => AppointmentAssignmentDto)
  assignment!: AppointmentAssignmentDto;
}
