import { describe, expect, it } from 'vitest';
import { normalizeCustomerEmail, normalizeCustomerPhone } from './customers.service.js';

describe('customer contact normalization', () => {
  it('lowercases email while preserving plus aliases', () => {
    expect(normalizeCustomerEmail('  Ana.Pérez+Turno@Example.test  ')).toBe('ana.pérez+turno@example.test');
  });

  it('keeps only phone digits and an optional leading plus', () => {
    expect(normalizeCustomerPhone('+54 (11) 4444-5555')).toBe('+541144445555');
    expect(normalizeCustomerPhone('(011) 4444-5555')).toBe('01144445555');
    expect(normalizeCustomerPhone('  ')).toBeNull();
  });
});
