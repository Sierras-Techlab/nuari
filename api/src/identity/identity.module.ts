import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from '../common/common.module.js';
import { CsrfGuard } from '../common/csrf.guard.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [CommonModule, IntegrationsModule],
  controllers: [IdentityController],
  providers: [IdentityService, PasswordHasher, SessionGuard, { provide: APP_GUARD, useClass: CsrfGuard }, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [IdentityService, PasswordHasher],
})
export class IdentityModule {}
