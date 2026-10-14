import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export enum CategoryStatusFilter { ACTIVE = 'active', INACTIVE = 'inactive', ALL = 'all' }

function strictQueryInteger(value: unknown): unknown {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return value;
  return Number(value);
}

export class ServiceCategoryListQueryDto {
  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(1) @Max(100)
  limit = 25;

  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(0) @Max(10_000)
  offset = 0;

  @IsEnum(CategoryStatusFilter)
  status = CategoryStatusFilter.ACTIVE;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @Length(1, 100)
  q?: string;
}

export class CreateServiceCategoryDto {
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString() @Length(1, 100)
  name!: string;

  @IsOptional() @IsInt() @Min(0) @Max(1_000_000)
  sortOrder = 0;
}

export class UpdateServiceCategoryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString() @Length(1, 100)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt() @Min(0) @Max(1_000_000)
  sortOrder?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
