import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
import { ServiceModality, ServicePricingType, StaffSelectionMode } from '../generated/prisma/client.js';

export enum ServiceStatusFilter { ACTIVE = 'active', INACTIVE = 'inactive', ALL = 'all' }

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function optionalText(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  return value.trim() || null;
}

function strictQueryInteger(value: unknown): unknown {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return value;
  return Number(value);
}

export function isValidServicePrice(value: unknown, currency: string): value is string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) return false;
  if (currency === 'CLP' && value.includes('.') && !/^\d+\.0{1,2}$/.test(value)) return false;
  return true;
}

export class ServiceListQueryDto {
  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(1) @Max(100)
  limit = 25;

  @Transform(({ value }: { value: unknown }) => strictQueryInteger(value))
  @IsInt() @Min(0) @Max(10_000)
  offset = 0;

  @IsEnum(ServiceStatusFilter)
  status = ServiceStatusFilter.ACTIVE;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsOptional() @IsString() @Length(1, 100)
  q?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsEnum(StaffSelectionMode)
  staffSelectionMode?: StaffSelectionMode;
}

export class CreateServiceDto {
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString() @Length(1, 150)
  name!: string;

  @Transform(({ value }: { value: unknown }) => optionalText(value))
  @IsOptional() @IsString() @Length(1, 2000)
  description?: string | null;

  @IsInt() @Min(5) @Max(720)
  durationMinutes!: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ServicePricingType)
  pricingType: ServicePricingType = ServicePricingType.ON_REQUEST;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString() @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  price?: string | null;

  @IsOptional() @IsUUID()
  categoryId?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt() @Min(0) @Max(1_000_000)
  sortOrder: number = 0;

  @IsEnum(StaffSelectionMode)
  staffSelectionMode!: StaffSelectionMode;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ServiceModality)
  modality: ServiceModality = ServiceModality.IN_PERSON;
}

export class UpdateServiceDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString() @Length(1, 150)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(({ value }: { value: unknown }) => optionalText(value))
  @IsString() @Length(1, 2000)
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt() @Min(5) @Max(720)
  durationMinutes?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ServicePricingType)
  pricingType?: ServicePricingType;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString() @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  price?: string | null;

  @IsOptional() @IsUUID()
  categoryId?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt() @Min(0) @Max(1_000_000)
  sortOrder?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(StaffSelectionMode)
  staffSelectionMode?: StaffSelectionMode;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ServiceModality)
  modality?: ServiceModality;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
