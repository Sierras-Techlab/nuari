import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateServiceDto, isValidServicePrice, UpdateServiceDto } from './services.dto.js';
import { CreateServiceCategoryDto, ServiceCategoryListQueryDto } from './service-categories.dto.js';

describe('service catalog DTOs', () => {
  it('trims names and accepts exact decimal strings, including zero', async () => {
    const input = plainToInstance(CreateServiceDto, {
      name: '  Corte  ', durationMinutes: 40, pricingType: 'FIXED', price: '0.00',
      staffSelectionMode: 'CUSTOMER_CHOICE',
    });
    expect(await validate(input)).toEqual([]);
    expect(input.name).toBe('Corte');
    expect(input.price).toBe('0.00');
  });

  it('rejects JSON numbers, exponent notation, extra scale, out of range values and nonintegral CLP', async () => {
    for (const price of [12.5, '1e3', '1.001', '10000000000.00']) {
      const input = plainToInstance(CreateServiceDto, {
        name: 'Servicio', durationMinutes: 40, pricingType: 'FIXED', price,
        staffSelectionMode: 'NO_ASSIGNMENT',
      });
      expect((await validate(input)).map(error => error.property)).toContain('price');
    }
    expect(isValidServicePrice('12.50', 'CLP')).toBe(false);
    expect(isValidServicePrice('12.00', 'CLP')).toBe(true);
  });

  it('requires the assignment mode at creation and rejects unsupported modality and duration', async () => {
    const noMode = plainToInstance(CreateServiceDto, { name: 'Consulta', durationMinutes: 30 });
    expect((await validate(noMode)).map(error => error.property)).toContain('staffSelectionMode');
    const invalid = plainToInstance(CreateServiceDto, {
      name: 'Remoto', durationMinutes: 721, modality: 'REMOTE', staffSelectionMode: 'AUTO_ASSIGN',
    });
    expect((await validate(invalid)).map(error => error.property).sort()).toEqual(['durationMinutes', 'modality']);
  });

  it('keeps PATCH values optional but rejects null enums and booleans', async () => {
    const input = plainToInstance(UpdateServiceDto, { active: null, pricingType: null, durationMinutes: null });
    expect((await validate(input)).map(error => error.property).sort()).toEqual(['active', 'durationMinutes', 'pricingType']);
  });

  it('rejects fractional query pagination and normalizes category names', async () => {
    const query = plainToInstance(ServiceCategoryListQueryDto, { limit: '1.5' });
    expect((await validate(query)).map(error => error.property)).toContain('limit');
    const category = plainToInstance(CreateServiceCategoryDto, { name: '  Cabello  ' });
    expect(await validate(category)).toEqual([]);
    expect(category.name).toBe('Cabello');
  });
});
