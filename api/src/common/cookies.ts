import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { SecurityConfig } from './security.config.js';

@Injectable()
export class AuthCookies {
  constructor(private readonly config: SecurityConfig) {}

  private options(): CookieOptions {
    return { httpOnly: true, secure: this.config.production, sameSite: 'lax', path: '/' };
  }

  session(response: Response, token: string, maxAge: number): void {
    response.cookie(this.config.sessionCookie, token, { ...this.options(), maxAge });
  }

  csrf(response: Response, token: string): void {
    response.cookie(this.config.csrfCookie, token, { ...this.options(), maxAge: 3_600_000 });
  }

  clear(response: Response): void {
    response.clearCookie(this.config.sessionCookie, this.options());
    response.clearCookie(this.config.csrfCookie, this.options());
  }
}
