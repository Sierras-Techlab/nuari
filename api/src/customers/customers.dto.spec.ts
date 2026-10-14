import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCustomerDto, CustomerListQueryDto, UpdateCustomerDto } from './customers.dto.js';

describe('customer DTOs', () => {
  it('trims names, lowercases emails, and accepts a customer without contacts', async () => {
    const input = plainToInstance(CreateCustomerDto, {
      name: '  Ana Pérez  ',
      email: ' Ana.Perez+turno@Example.test ',
      phone: '+54 (11) 4444-5555',
    });

    expect(await validate(input)).toEqual([]);
    expect(input.name).toBe('Ana Pérez');
    expect(input.email).toBe('ana.perez+turno@example.test');
    expect(input.phone).toBe('+54 (11) 4444-5555');
    expect(await validate(plainToInstance(CreateCustomerDto, { name: '  Sin contacto  ' }))).toEqual([]);
  });

  it('rejects short phone values and markup in internal notes', async () => {
    const input = plainToInstance(CreateCustomerDto, {
      name: 'Cliente',
      phone: '1234',
      notes: '<script>alert(1)</script>',
    });

    expect((await validate(input)).map(error => error.property).sort()).toEqual(['notes', 'phone']);
  });

  it('allows null to clear nullable fields but rejects null names and booleans', async () => {
    const input = plainToInstance(UpdateCustomerDto, { name: null, phone: null, active: null });

    expect((await validate(input)).map(error => error.property).sort()).toEqual(['active', 'name']);
  });

  it('rejects decimal query limits instead of coercing them', async () => {
    const input = plainToInstance(CustomerListQueryDto, { limit: '1.5' });

    expect((await validate(input)).map(error => error.property)).toContain('limit');
  });
});
