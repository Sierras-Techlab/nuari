import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ApiError } from '../common/errors.js';
import { randomToken } from '../common/crypto.js';

export const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, saltLength: 16 } as const;

@Injectable()
export class PasswordHasher implements OnModuleInit {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private dummy: Promise<string> | undefined;

  async onModuleInit(): Promise<void> {
    // Warm a same-cost dummy hash before the API begins serving credentials.
    this.dummy = this.hash(randomToken());
    await this.dummy;
  }

  private async bounded<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= 4) {
      if (this.waiting.length >= 32) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Intentá nuevamente más tarde.');
      await new Promise<void>(resolve => this.waiting.push(resolve));
    } else { this.active++; }
    try { return await operation(); }
    finally {
      const next = this.waiting.shift();
      if (next) next(); else this.active--;
    }
  }

  hash(password: string): Promise<string> { return this.bounded(() => argon2.hash(password, ARGON_OPTIONS)); }
  verify(hash: string, password: string): Promise<boolean> {
    return this.bounded(async () => { try { return await argon2.verify(hash, password); } catch { return false; } });
  }
  needsRehash(hash: string): boolean { return argon2.needsRehash(hash, ARGON_OPTIONS); }
  async verifyDummy(password: string): Promise<void> {
    this.dummy ??= this.hash(randomToken());
    await this.verify(await this.dummy, password);
  }
}
