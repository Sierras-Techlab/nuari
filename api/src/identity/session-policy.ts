export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionValid(session: { revokedAt: Date | null; expiresAt: Date; lastSeenAt: Date; credentialVersion: number }, version: number, now: Date): boolean {
  return session.revokedAt === null && session.credentialVersion === version && now < session.expiresAt && now.getTime() < session.lastSeenAt.getTime() + SESSION_IDLE_MS;
}
