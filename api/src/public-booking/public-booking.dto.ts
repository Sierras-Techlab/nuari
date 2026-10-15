import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Transform } from 'class-transformer';

export class PublicCustomerDto {
  @IsString() @MinLength(1) @MaxLength(150)
  name!: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsEmail() @MaxLength(254)
  email?: string;
}

export class PublicAssignmentDto {
  @IsIn(['SPECIFIC', 'ANY', 'NONE'])
  kind!: 'SPECIFIC' | 'ANY' | 'NONE';

  @IsOptional() @IsUUID('4')
  staffMemberId?: string;
}

export class PublicCreateAppointmentDto {
  @IsUUID('4') serviceId!: string;

  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;

  @ValidateNested() @Type(() => PublicAssignmentDto)
  assignment!: PublicAssignmentDto;

  @ValidateNested() @Type(() => PublicCustomerDto)
  customer!: PublicCustomerDto;
}

export class PublicManageTokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{40,100}$/)
  token!: string;
}

export class PublicRescheduleDto extends PublicManageTokenDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/)
  startAt!: string;

  @ValidateNested() @Type(() => PublicAssignmentDto)
  assignment!: PublicAssignmentDto;
}

export class PublicRescheduleAvailabilityDto extends PublicManageTokenDto {
  @IsIn(['SPECIFIC', 'ANY', 'NONE'])
  selection!: 'SPECIFIC' | 'ANY' | 'NONE';

  @IsOptional() @IsUUID('4')
  staffMemberId?: string;

  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string;

  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate!: string;

  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,2048}$/)
  cursor?: string;
}

export class PublicCancelDto extends PublicManageTokenDto {
  @IsIn(['CUSTOMER_REQUEST'])
  reasonCode!: 'CUSTOMER_REQUEST';
}

export class RevokeManagementLinkDto {
  @IsIn(['CUSTOMER_REQUEST', 'SECURITY_CONCERN', 'OTHER'])
  reasonCode!: 'CUSTOMER_REQUEST' | 'SECURITY_CONCERN' | 'OTHER';
}

export class PublicAvailabilityQueryDto {
  @IsUUID('4') serviceId!: string;
  @IsIn(['SPECIFIC', 'ANY', 'NONE']) selection!: 'SPECIFIC' | 'ANY' | 'NONE';
  @IsOptional() @IsUUID('4') staffMemberId?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fromDate?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) toDate?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/) at?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,2048}$/) cursor?: string;
}

export class PublicStaffQueryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : value)
  @IsOptional() @IsInt() @Min(0) @Max(10_000)
  offset = 0;
}
