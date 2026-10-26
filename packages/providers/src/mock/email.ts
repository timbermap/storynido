import type { EmailMessage, EmailProvider } from '@storynido/shared';

import { stableId } from '../crypto';

/** Guarda los mails en memoria (y opcionalmente los informa por log) en lugar de enviarlos. */
export class MockEmailProvider implements EmailProvider {
  readonly id = 'mock';
  readonly sent: EmailMessage[] = [];
  private readonly byKey = new Map<string, string>();

  constructor(private readonly onSend?: (message: EmailMessage) => void) {}

  send(message: EmailMessage): Promise<{ messageId: string }> {
    const existing = this.byKey.get(message.idempotencyKey);
    if (existing) return Promise.resolve({ messageId: existing });
    if (!message.to.includes('@'))
      return Promise.reject(new RangeError(`Destinatario inválido: ${message.to}`));

    const messageId = stableId('mock_msg', message.idempotencyKey);
    this.byKey.set(message.idempotencyKey, messageId);
    this.sent.push(message);
    this.onSend?.(message);
    return Promise.resolve({ messageId });
  }
}
