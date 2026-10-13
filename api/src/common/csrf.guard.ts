import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthRequest } from './request.js';
import { CsrfService } from './csrf.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (request.method === 'OPTIONS' || (request.method === 'GET' && request.path !== '/api/auth/csrf')) return true;
    if (request.method === 'GET' && request.path === '/api/auth/csrf') {
      this.csrf.checkOrigin(request, false);
      return true;
    }
    if (request.method === 'GET') return true;
    if (request.method === 'HEAD') return true;
    this.csrf.verify(request);
    return true;
  }
}
