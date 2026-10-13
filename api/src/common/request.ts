import type { Request } from 'express';

export type SessionPrincipal = { userId: string; sessionId: string; activeOrganizationId: string | null };
export type AuthRequest = Request & { principal?: SessionPrincipal };

export function cookieValue(request: Request, name: string): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value: unknown = Reflect.get(cookies, name);
  return typeof value === 'string' ? value : undefined;
}
