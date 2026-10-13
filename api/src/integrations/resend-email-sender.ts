import { Injectable } from '@nestjs/common';
import { SecurityConfig } from '../common/security.config.js';
import { EmailSender, type EmailMessage } from './email-sender.js';

@Injectable()
export class ResendEmailSender extends EmailSender {
  constructor(private readonly config: SecurityConfig) { super(); }

  async send(message: EmailMessage): Promise<void> {
    if (!this.config.resendApiKey || !this.config.emailFrom) throw new Error('Email transport is not configured.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.config.emailFrom, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(5000),
    });
    // Never include the provider response, address, URL or message in an error/log.
    if (!response.ok) { await response.body?.cancel(); throw new Error('Email delivery failed.'); }
    await response.body?.cancel();
  }
}
