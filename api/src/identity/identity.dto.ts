import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Length, Matches, MaxLength, registerDecorator, type ValidationOptions } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim().toLowerCase() : value;

export function Password(options?: ValidationOptions): PropertyDecorator {
  return (target, property) => registerDecorator({
    name: 'password', target: target.constructor, propertyName: String(property), options,
    validator: { validate: (value: unknown) => typeof value === 'string' && value.length >= 12 && value.length <= 128 && Buffer.byteLength(value, 'utf8') <= 1024,
      defaultMessage: () => 'Usá entre 12 y 128 caracteres (máximo 1024 bytes).' },
  });
}

export class LoginDto {
  @Transform(email) @IsString() @IsEmail() @MaxLength(254)
  email: string;
  @Password()
  password: string;
}
export class RegisterDto extends LoginDto {
  @Transform(trim) @IsString() @Length(1, 100)
  name: string;
}
export class EmailDto {
  @Transform(email) @IsString() @IsEmail() @MaxLength(254)
  email: string;
}
export class TokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/)
  token: string;
}
export class ResetPasswordDto extends TokenDto {
  @Password()
  password: string;
}
export class ActiveOrganizationDto {
  @IsUUID()
  organizationId: string;
}
export class EmptyDto {}
