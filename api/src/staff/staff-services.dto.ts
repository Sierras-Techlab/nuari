import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum RelatedResourceStatus { ACTIVE = 'active', INACTIVE = 'inactive', ALL = 'all' }

function strictQueryInteger(value: unknown): unknown {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return value;
  return Number(value);
}

export class StaffServiceListQueryDto {
  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(1) @Max(100)
  limit = 25;

  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(0) @Max(10_000)
  offset = 0;

  @IsOptional() @IsEnum(RelatedResourceStatus)
  status: RelatedResourceStatus = RelatedResourceStatus.ACTIVE;
}

export class PutStaffServiceDto {}
