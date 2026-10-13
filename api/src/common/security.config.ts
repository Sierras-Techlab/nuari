import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

const developmentSecrets = { csrf: randomBytes(32).toString('base64url'), rate: randomBytes(32).toString('base64url') };

export function validateOrigin(value: string, production: boolean): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('WEB_ORIGIN must be an exact HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.origin !== value.replace(/\/$/, '') || (production && url.protocol !== 'https:')) {
    throw new Error('WEB_ORIGIN must be an exact origin (HTTPS in production).');
  }
  return url.origin;
}

@Injectable()
export class SecurityConfig {
  readonly production = process.env.NODE_ENV === 'production';
  readonly webOrigin = validateOrigin(process.env.WEB_ORIGIN?.trim() || (this.production ? '' : 'http://localhost:3000'), this.production);
  readonly csrfSecret = this.secret('CSRF_SECRET', developmentSecrets.csrf);
  readonly rateLimitSecret = this.secret('RATE_LIMIT_SECRET', developmentSecrets.rate);
  readonly sessionCookie = this.production ? '__Host-nuari_session' : 'nuari_session';
  readonly csrfCookie = this.production ? '__Host-nuari_csrf' : 'nuari_csrf';
  readonly resendApiKey = process.env.RESEND_API_KEY || '';
  readonly emailFrom = process.env.EMAIL_FROM || '';
  readonly trustedProxies = this.proxies();

  constructor() {
    if (this.csrfSecret === this.rateLimitSecret) throw new Error('CSRF_SECRET and RATE_LIMIT_SECRET must differ.');
    if (this.production && (!this.resendApiKey || !this.emailFrom || process.env.TRUSTED_PROXY_CIDRS === undefined)) {
      throw new Error('RESEND_API_KEY, EMAIL_FROM and explicit TRUSTED_PROXY_CIDRS are required in production.');
    }
  }

  private secret(name: string, development: string): string {
    const value = process.env[name];
    if (!value && !this.production) return development;
    if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} requires at least 32 bytes.`);
    return value;
  }

  private proxies(): string[] {
    const values = (process.env.TRUSTED_PROXY_CIDRS || '').split(',').map(value => value.trim()).filter(Boolean);
    for (const value of values) {
      const [ip, prefix, ...extra] = value.split('/');
      const version = isIP(ip);
      if (!version || extra.length || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 0 || Number(prefix) > (version === 4 ? 32 : 128)))) {
        throw new Error('TRUSTED_PROXY_CIDRS must contain explicit IPs/CIDRs, never global trust or hops.');
      }
      if (prefix === '0') throw new Error('Global proxy trust is forbidden.');
    }
    return values;
  }
}
