import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { cookieValue, type AuthRequest } from '../common/request.js';
import { SecurityConfig } from '../common/security.config.js';
import { IdentityService } from './identity.service.js';
import { IS_PUBLIC } from './public.decorator.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly identity: IdentityService, private readonly config: SecurityConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (request.method === 'OPTIONS') return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) {
      // Public routes never acquire identity implicitly, including health and expired-cookie logout.
      return true;
    }
    request.principal = await this.identity.authenticate(cookieValue(request, this.config.sessionCookie));
    return true;
  }
}
