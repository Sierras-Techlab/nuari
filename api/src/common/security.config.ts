import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

const developmentSecrets = {
  csrf: randomBytes(32).toString('base64url'),
  rate: randomBytes(32).toString('base64url'),
  bookingSubmission: randomBytes(32).toString('base64url'),
  managementToken: randomBytes(32).toString('base64url'),
};

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
  readonly bookingSubmissionSecret = this.secret('BOOKING_SUBMISSION_SECRET', developmentSecrets.bookingSubmission);
  readonly bookingSubmissionSecretVersion = this.bookingSecretVersion();
  readonly bookingSubmissionPreviousSecrets = this.previousBookingSecrets();
  readonly managementTokenSecret = this.secret('MANAGEMENT_TOKEN_SECRET', developmentSecrets.managementToken);
  readonly managementTokenSecretVersion = this.managementSecretVersion();
  readonly managementTokenPreviousSecrets = this.previousManagementSecrets();
  readonly sessionCookie = this.production ? '__Host-nuari_session' : 'nuari_session';
  readonly csrfCookie = this.production ? '__Host-nuari_csrf' : 'nuari_csrf';
  readonly resendApiKey = process.env.RESEND_API_KEY || '';
  readonly emailFrom = process.env.EMAIL_FROM || '';
  readonly trustedProxies = this.proxies();

  constructor() {
    if (new Set([this.csrfSecret, this.rateLimitSecret, this.bookingSubmissionSecret, this.managementTokenSecret]).size !== 4) {
      throw new Error('CSRF_SECRET, RATE_LIMIT_SECRET, BOOKING_SUBMISSION_SECRET and MANAGEMENT_TOKEN_SECRET must differ.');
    }
    if (this.production && (!this.resendApiKey || !this.emailFrom || process.env.TRUSTED_PROXY_CIDRS === undefined)) {
      throw new Error('RESEND_API_KEY, EMAIL_FROM and explicit TRUSTED_PROXY_CIDRS are required in production.');
    }
  }

  bookingSubmissionSecretFor(version: number): string | undefined {
    if (version === this.bookingSubmissionSecretVersion) return this.bookingSubmissionSecret;
    return this.bookingSubmissionPreviousSecrets.get(version);
  }

  managementTokenSecretFor(version: number): string | undefined {
    if (version === this.managementTokenSecretVersion) return this.managementTokenSecret;
    return this.managementTokenPreviousSecrets.get(version);
  }

  private bookingSecretVersion(): number {
    const value = process.env.BOOKING_SUBMISSION_SECRET_VERSION;
    if (value === undefined || value === '') return 1;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new Error('BOOKING_SUBMISSION_SECRET_VERSION must be a positive integer.');
    }
    return Number(value);
  }

  private previousBookingSecrets(): Map<number, string> {
    return this.previousSecrets('BOOKING_SUBMISSION_PREVIOUS_SECRETS', this.bookingSubmissionSecretVersion);
  }

  private managementSecretVersion(): number {
    return this.readSecretVersion('MANAGEMENT_TOKEN_SECRET_VERSION');
  }

  private previousManagementSecrets(): Map<number, string> {
    return this.previousSecrets('MANAGEMENT_TOKEN_PREVIOUS_SECRETS', this.managementTokenSecretVersion);
  }

  private readSecretVersion(name: string): number {
    const value = process.env[name];
    if (value === undefined || value === '') return 1;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name} must be a positive integer.`);
    return Number(value);
  }

  private previousSecrets(name: string, currentVersion: number): Map<number, string> {
    const value = process.env[name];
    if (!value) return new Map();
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { throw new Error(`${name} must be a JSON object.`); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${name} must be a JSON object.`);
    }
    const secrets = new Map<number, string>();
    for (const [rawVersion, secret] of Object.entries(parsed)) {
      const version = Number(rawVersion);
      if (!/^[1-9]\d*$/.test(rawVersion) || !Number.isSafeInteger(version) || version === currentVersion ||
        typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
        throw new Error(`${name} entries require unique positive versions and at least 32 bytes.`);
      }
      secrets.set(version, secret);
    }
    return secrets;
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
