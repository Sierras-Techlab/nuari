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
});
