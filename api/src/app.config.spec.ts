import { describe, expect, it } from 'vitest';

import { getApiPort, getWebOrigin } from './app.config.js';

describe('getWebOrigin', () => {
  it('uses the local web origin outside production', () => {
    expect(getWebOrigin({ NODE_ENV: 'development' })).toBe(
      'http://localhost:3000',
    );
  });

  it('normalizes the configured web origin', () => {
    expect(
      getWebOrigin({
        NODE_ENV: 'production',
        WEB_ORIGIN: 'https://app.nuari.com/',
      }),
    ).toBe('https://app.nuari.com');
  });

  it('rejects a missing production web origin', () => {
    expect(() => getWebOrigin({ NODE_ENV: 'production' })).toThrow(
      'WEB_ORIGIN',
    );
  });
});

describe('getApiPort', () => {
  it('uses port 3001 by default', () => {
    expect(getApiPort({})).toBe(3001);
  });

  it('parses a configured port', () => {
    expect(getApiPort({ PORT: '4100' })).toBe(4100);
  });

  it('rejects an invalid port', () => {
    expect(() => getApiPort({ PORT: 'invalid' })).toThrow('PORT');
  });
});
