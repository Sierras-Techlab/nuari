import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export enum StaffStatusFilter { ACTIVE = 'active', INACTIVE = 'inactive', ALL = 'all' }

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimmedOptional(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  return value.trim() || null;
}

function normalizedEmail(value: unknown): unknown {
  const result = trimmedOptional(value);
  return typeof result === 'string' ? result.toLowerCase() : result;
}

function strictQueryInteger(value: unknown): unknown {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return value;
  return Number(value);
}

export class StaffListQueryDto {
  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(1) @Max(100)
  limit = 25;

  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(0) @Max(10_000)
  offset = 0;

  @IsEnum(StaffStatusFilter)
  status = StaffStatusFilter.ACTIVE;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @Length(1, 100)
  q?: string;

  @IsOptional() @IsUUID()
  serviceId?: string;
}

export class CreateStaffMemberDto {
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString() @Length(1, 150)
  name!: string;

  @Transform(({ value }: { value: unknown }) => normalizedEmail(value))
  @IsOptional() @IsEmail() @Length(3, 254)
  email?: string | null;

  @Transform(({ value }: { value: unknown }) => trimmedOptional(value))
  @IsOptional() @IsString() @MaxLength(30)
  @Matches(/^\+?(?=(?:\D*\d){7,15}\D*$)[\d\s()-]+$/)
  phone?: string | null;
}

export class UpdateStaffMemberDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString() @Length(1, 150)
  name?: string;

  @Transform(({ value }: { value: unknown }) => normalizedEmail(value))
  @IsOptional() @IsEmail() @Length(3, 254)
  email?: string | null;

  @Transform(({ value }: { value: unknown }) => trimmedOptional(value))
  @IsOptional() @IsString() @MaxLength(30)
  @Matches(/^\+?(?=(?:\D*\d){7,15}\D*$)[\d\s()-]+$/)
  phone?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
