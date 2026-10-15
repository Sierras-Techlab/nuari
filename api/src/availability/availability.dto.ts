import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class AvailabilityQueryDto {
  @IsString() @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  serviceId: string;

  @IsIn(['SPECIFIC', 'ANY', 'NONE'])
  selection: 'SPECIFIC' | 'ANY' | 'NONE';

  @IsOptional()
  @IsString() @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  staffMemberId?: string;

  @IsOptional()
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @IsOptional()
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @IsOptional()
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/)
  at?: string;

  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,2048}$/)
  cursor?: string;
}
