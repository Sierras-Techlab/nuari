import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, MaxLength, ValidateIf } from 'class-validator';

export enum CustomerStatusFilter {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ALL = 'all',
}

function trimmedOptional(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  return value.trim() || null;
}

function normalizedEmail(value: unknown): unknown {
  const trimmed = trimmedOptional(value);
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
}

function strictQueryInteger(value: unknown): unknown {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return value;
  return Number(value);
}

export class CreateCustomerDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 150)
  name!: string;

  @Transform(({ value }: { value: unknown }) => trimmedOptional(value))
  @IsOptional() @IsString() @MaxLength(30)
  @Matches(/^\+?(?=(?:\D*\d){7,15}\D*$)[\d\s()-]+$/)
  phone?: string | null;

  @Transform(({ value }: { value: unknown }) => normalizedEmail(value))
  @IsOptional() @IsEmail() @Length(3, 254)
  email?: string | null;

  @Transform(({ value }: { value: unknown }) => trimmedOptional(value))
  @IsOptional() @IsString() @MaxLength(4000)
  @Matches(/^(?![\s\S]*<\/?[a-z][^>]*>)[\s\S]*$/i)
  notes?: string | null;
}

export class UpdateCustomerDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 150)
  name?: string;

  @Transform(({ value }: { value: unknown }) => trimmedOptional(value))
  @IsOptional() @IsString() @MaxLength(30)
  @Matches(/^\+?(?=(?:\D*\d){7,15}\D*$)[\d\s()-]+$/)
  phone?: string | null;

  @Transform(({ value }: { value: unknown }) => normalizedEmail(value))
  @IsOptional() @IsEmail() @Length(3, 254)
  email?: string | null;

  @Transform(({ value }: { value: unknown }) => trimmedOptional(value))
  @IsOptional() @IsString() @MaxLength(4000)
  @Matches(/^(?![\s\S]*<\/?[a-z][^>]*>)[\s\S]*$/i)
  notes?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}

export class CustomerListQueryDto {
  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(1) @Max(100)
  limit = 25;

  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(0) @Max(10_000)
  offset = 0;

  @IsEnum(CustomerStatusFilter)
  status = CustomerStatusFilter.ACTIVE;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @Length(1, 100)
  q?: string;
}

export class DuplicateCustomerCandidatesQueryDto {
  @Transform(({ value }: { value: unknown }) => normalizedEmail(value))
  @IsOptional() @IsEmail() @Length(3, 254)
  email?: string | null;

  @Transform(({ value }: { value: unknown }) => trimmedOptional(value))
  @IsOptional() @IsString() @MaxLength(30)
  @Matches(/^\+?(?=(?:\D*\d){7,15}\D*$)[\d\s()-]+$/)
  phone?: string | null;

  @IsOptional() @IsUUID()
  excludeId?: string;
}
