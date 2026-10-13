import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { Clock } from './clock.js';
import { ApiError } from './errors.js';
import { SecurityConfig } from './security.config.js';

@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  constructor(private readonly db: PrismaService, private readonly clock: Clock, private readonly config: SecurityConfig) {}

  async consume(scope: string, identifier: string, limit: number, windowMs: number): Promise<void> {
    const now = this.clock.now();
    const start = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const expires = new Date(start.getTime() + windowMs);
    const key = createHmac('sha256', this.config.rateLimitSecret).update(`${scope}:${identifier}`).digest('hex');
    const rows = await this.db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("scope", "keyHash", "windowStartedAt", "count", "expiresAt")
      VALUES (${scope}, ${key}, ${start}, 1, ${expires})
      ON CONFLICT ("scope", "keyHash", "windowStartedAt")
      DO UPDATE SET "count" = LEAST("RateLimitBucket"."count" + 1, ${limit + 1})
      RETURNING "count"`;
    // One bounded cleanup per request; only expired limiter records, never domain data.
    await this.db.$executeRaw`DELETE FROM "RateLimitBucket" WHERE ctid IN (SELECT ctid FROM "RateLimitBucket" WHERE "expiresAt" < ${now} LIMIT 32)`;
    if (!rows[0] || rows[0].count > limit) {
      this.logger.warn('rate_limited');
      throw new ApiError(429, 'RATE_LIMITED', 'Demasiados intentos. Intentá más tarde.', undefined, Math.max(1, Math.ceil((expires.getTime() - now.getTime()) / 1000)));
    }
  }
}
