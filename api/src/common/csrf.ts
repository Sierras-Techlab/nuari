import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { Clock } from './clock.js';
import { constantEqual, isToken, randomToken, sha256 } from './crypto.js';
import { ApiError } from './errors.js';
import { cookieValue } from './request.js';
import { SecurityConfig } from './security.config.js';

@Injectable()
export class CsrfService {
  constructor(private readonly config: SecurityConfig, private readonly clock: Clock) {}

  private context(sessionToken?: string): string {
    return sessionToken ? sha256(sessionToken) : 'anonymous';
  }

  private sign(payload: string, sessionToken?: string): string {
    // The session hash is signing context only; it is never serialized in the token.
    return createHmac('sha256', this.config.csrfSecret).update(`${payload}.${this.context(sessionToken)}`).digest('base64url');
  }

  issue(sessionToken?: string): string {
    const payload = `${randomToken()}.${this.clock.now().getTime() + 3_600_000}`;
    return `${payload}.${this.sign(payload, sessionToken)}`;
  }

  checkOrigin(request: Request, mutation: boolean): void {
    const origin = request.get('origin');
    const site = request.get('sec-fetch-site');
    if (site === 'cross-site' || (origin !== undefined && origin !== this.config.webOrigin) || (mutation && origin !== this.config.webOrigin) || (!mutation && origin === undefined && site !== 'same-origin')) {
      throw new ApiError(403, 'CSRF_INVALID', 'La solicitud no pudo verificarse.');
    }
    if (mutation && request.headers['content-length'] !== '0' && (request.headers['transfer-encoding'] || Number(request.headers['content-length'] || 0) > 0) && !request.is('application/json')) {
      throw new ApiError(403, 'CSRF_INVALID', 'La solicitud no pudo verificarse.');
    }
  }

  verify(request: Request): void {
    this.checkOrigin(request, true);
    const header = request.get('x-csrf-token');
    const cookie = cookieValue(request, this.config.csrfCookie);
    if (!header || !cookie || header.length > 200 || !constantEqual(header, cookie)) return this.invalid();
    const [nonce, expiration, signature, ...extra] = header.split('.');
    if (extra.length || !isToken(nonce) || !/^\d{13}$/.test(expiration || '') || !isToken(signature) || this.clock.now().getTime() >= Number(expiration) || Number(expiration) > this.clock.now().getTime() + 3_600_000) return this.invalid();
    if (!constantEqual(signature, this.sign(`${nonce}.${expiration}`, cookieValue(request, this.config.sessionCookie)))) return this.invalid();
  }

  private invalid(): never {
    throw new ApiError(403, 'CSRF_INVALID', 'La solicitud no pudo verificarse.');
  }
}
