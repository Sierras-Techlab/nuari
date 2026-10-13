import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password-hasher.js';

describe('Argon2id password adapter', () => {
  it('stores PHC, uses required parameters and random salts', async () => {
    const hasher = new PasswordHasher();
    const first = await hasher.hash('exactly  password  ');
    const second = await hasher.hash('exactly  password  ');
    expect(first).toMatch(/^\$argon2id\$v=19\$/);
    expect(new Set(first.split('$')[3].split(','))).toEqual(new Set(['m=19456', 't=2', 'p=1']));
    expect(first).not.toBe(second);
    expect(await hasher.verify(first, 'exactly  password  ')).toBe(true);
    expect(await hasher.verify(first, 'exactly password')).toBe(false);
    expect(hasher.needsRehash(first)).toBe(false);
    await hasher.verifyDummy('nonexistent account password');
    expect(await hasher.verify('not a valid hash', 'anything')).toBe(false);
  });
});
