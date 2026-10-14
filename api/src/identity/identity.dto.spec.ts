import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './identity.dto.js';
import { CreateOrganizationDto } from '../organizations/organizations.dto.js';

const valid = { name: '  Test Name  ', email: '  TEST+alias@Example.com  ', password: '  untrimmed password  ' };
describe('boundary DTOs', () => {
  it('normalizes name/email, preserves aliases and passwords exactly', async () => {
    const dto = plainToInstance(RegisterDto, valid);
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ name: 'Test Name', email: 'test+alias@example.com', password: valid.password });
  });
  it.each(['short', 'x'.repeat(129), 123, null])('rejects invalid password %s', async password => expect((await validate(plainToInstance(RegisterDto, { ...valid, password }))).length).toBeGreaterThan(0));
  it('rejects unknown fields without reflecting their values', async () => {
    const errors = await validate(plainToInstance(RegisterDto, { ...valid, role: 'OWNER' }), { whitelist: true, forbidNonWhitelisted: true, validationError: { value: false, target: false } });
    expect(errors[0].property).toBe('role');
    expect(errors[0].value).toBeUndefined();
  });
  it.each(['api', 'nuari', 'UPPER', 'two--dashes', '-bad', 'ab', 'x'.repeat(64)])('rejects noncanonical/reserved slug %s', async slug => expect((await validate(plainToInstance(CreateOrganizationDto, { name: 'Test', slug, businessType: 'SERVICES', planCode: 'TOURISM' }))).length).toBeGreaterThan(0));
  it('accepts any approved type/plan combination', async () => expect(await validate(plainToInstance(CreateOrganizationDto, { name: 'Test', slug: 'valid-slug', businessType: 'SERVICES', planCode: 'TOURISM' }))).toEqual([]));
  it('does not implicitly coerce nonstrings', async () => expect((await validate(plainToInstance(RegisterDto, { ...valid, name: 42 }))).length).toBeGreaterThan(0));

  it('accepts only safe relative return paths for verification handoff', async () => {
    const dto = plainToInstance(RegisterDto, { ...valid, returnTo: '/invitacion/invitation-token-123456789' });
    expect(await validate(dto)).toEqual([]);
  });

  it.each(['https://evil.test', '//evil.test', '/\\\\evil.test', '/invitacion/\u0000token'])('rejects unsafe verification return path %s', async returnTo => {
    const errors = await validate(plainToInstance(RegisterDto, { ...valid, returnTo }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('UpdateOrganizationDto accepts empty string or null for email and optional fields', async () => {
    const { UpdateOrganizationDto } = await import('../organizations/organizations.dto.js');
    const dtoWithEmpty = plainToInstance(UpdateOrganizationDto, {
      name: 'Test Org',
      email: '',
      phone: '',
      website: '',
      description: '',
    });
    expect(await validate(dtoWithEmpty, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);

    const dtoWithNull = plainToInstance(UpdateOrganizationDto, {
      name: 'Test Org',
      email: null,
      phone: null,
      website: null,
      description: null,
    });
    expect(await validate(dtoWithNull, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);

    const dtoWithValidEmail = plainToInstance(UpdateOrganizationDto, {
      email: 'contacto@ejemplo.com', confirmCurrencyChange: true,
    });
    expect(await validate(dtoWithValidEmail, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);

    const dtoWithInvalidConfirmation = plainToInstance(UpdateOrganizationDto, { confirmCurrencyChange: null });
    expect((await validate(dtoWithInvalidConfirmation, { whitelist: true, forbidNonWhitelisted: true })).map(error => error.property)).toEqual(['confirmCurrencyChange']);

    const dtoWithInvalidEmail = plainToInstance(UpdateOrganizationDto, {
      email: 'not-an-email',
    });
    expect((await validate(dtoWithInvalidEmail, { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
  });

  it('reproduces exact user payload with Nest ValidationPipe', async () => {
    const { ValidationPipe } = await import('@nestjs/common');
    const { UpdateOrganizationDto } = await import('../organizations/organizations.dto.js');
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: false },
    });

    const payload = {
      name: "Tatuajes de Uriel",
      slug: "tatuajes-de-uriel",
      description: "Hago tatuajes de pitos",
      email: "urialessandro2@gmail.com",
      phone: "3541 203098",
      website: "sierrastechlab.com",
      state: "Córdoba",
      city: "Tero Violado",
      zip: "5152",
      address: "Gato Garchado 450",
    };

    const transformed = await pipe.transform(payload, {
      type: 'body',
      metatype: UpdateOrganizationDto,
    });
    expect(transformed.name).toBe("Tatuajes de Uriel");
  });

  it('accepts partial PATCH with only { name } through Nest ValidationPipe without missing field errors', async () => {
    const { ValidationPipe } = await import('@nestjs/common');
    const { UpdateOrganizationDto } = await import('../organizations/organizations.dto.js');
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    });

    const transformed = await pipe.transform({ name: 'Nuevo nombre' }, {
      type: 'body',
      metatype: UpdateOrganizationDto,
    });
    expect(transformed).toBeInstanceOf(UpdateOrganizationDto);
    expect(transformed.name).toBe('Nuevo nombre');
    expect(transformed.country).toBeUndefined();
    expect(transformed.timezone).toBeUndefined();
    expect(transformed.currency).toBeUndefined();
    expect(transformed.logoUrl).toBeUndefined();
  });
});
