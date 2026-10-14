import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { EmailSender, type EmailMessage } from './email-sender.js';

@Injectable()
export class EmailDispatcher implements OnModuleDestroy {
  private readonly logger = new Logger(EmailDispatcher.name);
  private readonly queue: Array<{ message: EmailMessage; resolve: (delivered: boolean) => void }> = [];
  private readonly pending = new Set<Promise<void>>();
  private closing = false;

  constructor(private readonly sender: EmailSender) {}

  enqueue(message: EmailMessage): Promise<boolean> {
    if (this.closing || this.queue.length + this.pending.size >= 100) {
      this.logger.warn('email_dispatch_saturated');
      return Promise.resolve(false);
    }
    const delivery = new Promise<boolean>(resolve => this.queue.push({ message, resolve }));
    this.pump();
    return delivery;
  }

  private pump(): void {
    while (this.pending.size < 4 && this.queue.length) {
      const item = this.queue.shift();
      if (!item) break;
      const delivery = Promise.resolve().then(() => this.sender.send(item.message)).then(() => {
        item.resolve(true);
      }).catch(() => {
        item.resolve(false);
        this.logger.warn('email_delivery_failed');
      }).finally(() => { this.pending.delete(delivery); this.pump(); });
      this.pending.add(delivery);
    }
  }

  async drain(timeoutMs = 6000): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => { while (this.pending.size) await Promise.all(this.pending); })(),
        new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs); timer.unref(); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    await this.drain();
    if (this.pending.size || this.queue.length) this.logger.warn('email_shutdown_timeout');
    this.queue.length = 0;
  }
}
