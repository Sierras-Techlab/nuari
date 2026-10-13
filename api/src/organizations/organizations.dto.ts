import { Transform } from 'class-transformer';
import { IsEnum, IsNotIn, IsString, Length, Matches } from 'class-validator';
import { BusinessType, PlanCode } from '../generated/prisma/client.js';

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
