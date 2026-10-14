import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotIn, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { BusinessType, OrganizationRole, PlanCode } from '../generated/prisma/client.js';


export class CreateOrganizationDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 100)
  name: string;
  @IsString() @Length(3, 63) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @IsNotIn(['api', 'app', 'login', 'register', 'onboarding', 'admin', 'www', 'support', 'nuari'])
  slug: string;
  @IsEnum(BusinessType)
  businessType: BusinessType;
  @IsEnum(PlanCode)
  planCode: PlanCode;
}

export const REGIONAL_CONFIG = {
  AR: {
    currency: 'ARS',
    timezones: ['America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza'],
  },
  UY: {
    currency: 'UYU',
    timezones: ['America/Montevideo'],
  },
  CL: {
    currency: 'CLP',
    timezones: ['America/Santiago', 'America/Punta_Arenas', 'Pacific/Easter'],
  },
  BR: {
    currency: 'BRL',
    timezones: ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Rio_Branco'],
  },
  MX: {
    currency: 'MXN',
    timezones: ['America/Mexico_City', 'America/Cancun', 'America/Tijuana', 'America/Hermosillo', 'America/Mazatlan'],
  },
  CO: {
    currency: 'COP',
    timezones: ['America/Bogota'],
  },
  PE: {
    currency: 'PEN',
    timezones: ['America/Lima'],
  },
} as const;

export type SupportedCountry = keyof typeof REGIONAL_CONFIG;

export class UpdateOrganizationDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 100)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(3, 63) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @IsNotIn(['api', 'app', 'login', 'register', 'onboarding', 'admin', 'www', 'support', 'nuari'])
  slug?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 500)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @ValidateIf((_obj, val) => val !== '' && val !== null && val !== undefined)
  @IsEmail()
  @Length(3, 254)
  email?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 30)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 200)
  website?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  country?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 100)
  state?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 100)
  city?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 20)
  zip?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 200)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  currency?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString() @Length(0, 500)
  logoUrl?: string | null;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}

export class CreateInvitationDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString() @Length(3, 254)
  email: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}


