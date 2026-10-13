import { Module } from '@nestjs/common';
import { EmailSender } from './email-sender.js';
import { ResendEmailSender } from './resend-email-sender.js';
import { EmailDispatcher } from './email-dispatcher.js';

@Module({
  providers: [{ provide: EmailSender, useClass: ResendEmailSender }, EmailDispatcher],
  exports: [EmailSender, EmailDispatcher],
})
export class IntegrationsModule {}
