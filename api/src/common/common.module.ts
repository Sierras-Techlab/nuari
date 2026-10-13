import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { Clock, SystemClock } from './clock.js';
import { SecurityConfig } from './security.config.js';
import { AuthCookies } from './cookies.js';
import { CsrfService } from './csrf.js';
import { RateLimiter } from './rate-limiter.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [{ provide: Clock, useClass: SystemClock }, SecurityConfig, AuthCookies, CsrfService, RateLimiter],
  exports: [Clock, SecurityConfig, AuthCookies, CsrfService, RateLimiter],
})
export class CommonModule {}
