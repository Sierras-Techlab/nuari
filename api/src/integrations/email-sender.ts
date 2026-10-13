import { Injectable } from '@nestjs/common';

export type EmailMessage = { to: string; subject: string; text: string };

@Injectable()
export abstract class EmailSender {
  abstract send(message: EmailMessage): Promise<void>;
}
