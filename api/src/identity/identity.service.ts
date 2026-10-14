import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { TransactionContext } from '../common/transaction.js';
import { Clock } from '../common/clock.js';
import { isToken, randomToken, sha256 } from '../common/crypto.js';
import { ApiError, invalidToken, unauthenticated } from '../common/errors.js';
import type { SessionPrincipal } from '../common/request.js';
import { SecurityConfig } from '../common/security.config.js';
import { EmailDispatcher } from '../integrations/email-dispatcher.js';
import { PasswordHasher } from './password-hasher.js';
import { isSafeReturnTo, type RegisterDto } from './identity.dto.js';
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, sessionValid } from './session-policy.js';
import type { User } from '../generated/prisma/client.js';

export const userDto = (user: User) => ({ id: user.id, name: user.name, email: user.email, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null });
type TokenPurpose = 'verification' | 'reset';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  constructor(private readonly db: PrismaService, private readonly hasher: PasswordHasher, private readonly clock: Clock, private readonly dispatcher: EmailDispatcher, private readonly config: SecurityConfig) {}

  async lockUser(tx: TransactionContext, userId: string): Promise<User> {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthenticated();
    return user;
  }

  private async createToken(tx: TransactionContext, userId: string, purpose: TokenPurpose, now: Date, revokeExisting = true): Promise<{ token: string; id: string }> {
    const token = randomToken();
    const data = { userId, tokenHash: sha256(token), createdAt: now, expiresAt: new Date(now.getTime() + (purpose === 'verification' ? 86_400_000 : 1_800_000)) };
    if (purpose === 'verification') {
      if (revokeExisting) await tx.emailVerificationToken.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      const created = await tx.emailVerificationToken.create({ data });
      return { token, id: created.id };
    } else {
      await tx.passwordResetToken.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      const created = await tx.passwordResetToken.create({ data });
      return { token, id: created.id };
    }
  }

  private validateReturnTo(returnTo?: string): string | undefined {
    if (returnTo !== undefined && !isSafeReturnTo(returnTo)) throw new ApiError(400, 'VALIDATION_ERROR', 'La ruta de retorno no es válida.');
    return returnTo;
  }

  private send(email: string, token: string, purpose: TokenPurpose, returnTo?: string): Promise<boolean> {
    const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    return this.dispatcher.enqueue({ to: email, subject: purpose === 'verification' ? 'Verificá tu correo en Nuari' : 'Restablecé tu contraseña de Nuari', text: `${this.config.webOrigin}/${purpose === 'verification' ? 'verify-email' : 'reset-password'}${query}#token=${token}` });
  }

  async register(input: RegisterDto): Promise<void> {
    const returnTo = this.validateReturnTo(input.returnTo);
    // Both duplicate and new registrations pay the same password-hashing cost.
    const passwordHash = await this.hasher.hash(input.password);
    const result = await this.db.$transaction(async tx => {
      const now = this.clock.now();
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "User" ("id", "name", "email", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${input.name}, ${input.email}, ${now}, ${now})
        ON CONFLICT ("email") DO NOTHING RETURNING "id"`;
      if (!rows[0]) return null;
      const userId = rows[0].id;
      await tx.userCredential.create({ data: { userId, passwordHash, passwordChangedAt: now, updatedAt: now } });
      return { token: (await this.createToken(tx, userId, 'verification', now)).token };
    });
    if (result) void this.send(input.email, result.token, 'verification', returnTo);
  }

  async login(email: string, password: string, presentedToken?: string) {
    const observed = await this.db.user.findUnique({ where: { email }, include: { credential: true } });
    const invalid = () => { this.logger.warn('login_failed'); return new ApiError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos.'); };
    if (!observed?.credential) { await this.hasher.verifyDummy(password); throw invalid(); }
    if (!await this.hasher.verify(observed.credential.passwordHash, password)) throw invalid();
    const rehashed = this.hasher.needsRehash(observed.credential.passwordHash) ? await this.hasher.hash(password) : undefined;
    const token = randomToken();
    const result = await this.db.$transaction(async tx => {
      const user = await this.lockUser(tx, observed.id);
      const credential = await tx.userCredential.findUnique({ where: { userId: user.id } });
      if (!credential || credential.version !== observed.credential?.version || credential.passwordHash !== observed.credential.passwordHash) throw invalid();
      const now = this.clock.now();
      if (rehashed) await tx.userCredential.update({ where: { userId: user.id }, data: { passwordHash: rehashed } });
      if (isToken(presentedToken)) await tx.session.updateMany({ where: { tokenHash: sha256(presentedToken), revokedAt: null }, data: { revokedAt: now } });
      const session = await tx.session.create({ data: { userId: user.id, tokenHash: sha256(token), credentialVersion: credential.version, createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS) } });
      return { user: userDto(user), expiresAt: session.expiresAt };
    });
    return { ...result, token };
  }

  async authenticate(token?: string): Promise<SessionPrincipal> {
    if (!isToken(token)) throw unauthenticated();
    // Lock order is always User then Session, matching reset/login/onboarding.
    return this.db.$transaction(async tx => {
      const initial = await tx.session.findUnique({ where: { tokenHash: sha256(token) }, select: { userId: true } });
      if (!initial) throw unauthenticated();
      await this.lockUser(tx, initial.userId);
      const session = await tx.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { credential: true } } } });
      const now = this.clock.now();
      if (!session || !session.user.credential || !sessionValid(session, session.user.credential.version, now)) throw unauthenticated();
      const changed = await tx.session.updateMany({ where: { id: session.id, revokedAt: null, credentialVersion: session.user.credential.version, expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - SESSION_IDLE_MS) } }, data: { lastSeenAt: now } });
      if (changed.count !== 1) throw unauthenticated();
      return { userId: session.userId, sessionId: session.id, activeOrganizationId: session.activeOrganizationId };
    });
  }

  async currentUser(userId: string): Promise<User> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthenticated();
    return user;
  }

  async assertSession(tx: TransactionContext, principal: SessionPrincipal): Promise<void> {
    const session = await tx.session.findUnique({ where: { id: principal.sessionId }, include: { user: { include: { credential: true } } } });
    if (!session || session.userId !== principal.userId || !session.user.credential || !sessionValid(session, session.user.credential.version, this.clock.now())) throw unauthenticated();
  }

  async selectOrganization(tx: TransactionContext, principal: SessionPrincipal, organizationId: string | null): Promise<void> {
    await this.assertSession(tx, principal);
    await tx.session.update({ where: { id: principal.sessionId }, data: { activeOrganizationId: organizationId } });
  }

  async logout(token?: string): Promise<void> {
    if (isToken(token)) {
      await this.db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: this.clock.now() } });
      this.logger.log('session_revoked');
    }
  }

  async requestVerification(userId: string, requestedReturnTo?: string): Promise<void> {
    const returnTo = this.validateReturnTo(requestedReturnTo);
    const result = await this.db.$transaction(async tx => {
      const user = await this.lockUser(tx, userId);
      if (user.emailVerifiedAt) return null;
      const created = await this.createToken(tx, userId, 'verification', this.clock.now(), false);
      return { email: user.email, token: created.token, tokenId: created.id };
    });
    if (!result || !(await this.send(result.email, result.token, 'verification', returnTo))) return;
    await this.db.$transaction(async tx => {
      const user = await this.lockUser(tx, userId);
      if (user.emailVerifiedAt) return;
      const now = this.clock.now();
      const latest = await tx.emailVerificationToken.findFirst({
        where: { userId, consumedAt: null, expiresAt: { gt: now } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      if (latest?.id !== result.tokenId) return;
      await tx.emailVerificationToken.updateMany({ where: { userId, id: { not: result.tokenId }, consumedAt: null }, data: { consumedAt: now } });
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const observed = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (!observed) return;
    const result = await this.db.$transaction(async tx => {
      const user = await this.lockUser(tx, observed.id);
      return { email: user.email, token: (await this.createToken(tx, user.id, 'reset', this.clock.now())).token };
    });
    void this.send(result.email, result.token, 'reset');
  }

  async confirmVerification(token: string): Promise<void> {
    const observed = await this.db.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!observed) throw invalidToken();
    await this.db.$transaction(async tx => {
      const user = await this.lockUser(tx, observed.userId);
      const now = this.clock.now();
      const consumed = await tx.emailVerificationToken.updateMany({ where: { id: observed.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (consumed.count !== 1) {
        if (user.emailVerifiedAt) return;
        throw invalidToken();
      }
      await tx.user.update({ where: { id: observed.userId }, data: { emailVerifiedAt: now } });
    });
  }

  async confirmPasswordReset(token: string, password: string): Promise<void> {
    const observed = await this.db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!observed) throw invalidToken();
    const passwordHash = await this.hasher.hash(password);
    await this.db.$transaction(async tx => {
      await this.lockUser(tx, observed.userId);
      const now = this.clock.now();
      const consumed = await tx.passwordResetToken.updateMany({ where: { id: observed.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (consumed.count !== 1) throw invalidToken();
      await tx.userCredential.update({ where: { userId: observed.userId }, data: { passwordHash, version: { increment: 1 }, passwordChangedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: observed.userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.session.updateMany({ where: { userId: observed.userId, revokedAt: null }, data: { revokedAt: now } });
    });
    this.logger.log('password_reset_sessions_revoked');
  }
}
