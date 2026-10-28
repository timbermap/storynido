import { renderEmail, type EmailBrand } from '@storynido/emails';
import { ProviderError, type EmailMessage, type EmailProvider } from '@storynido/shared';
import { z } from 'zod';

export interface ResendOptions {
  apiKey: string;
  /** Remitente verificado en Resend, por ejemplo "StoryNido <hola@storynido.com>". */
  from: string;
  replyTo?: string;
  brand: EmailBrand;
  fetchImpl?: typeof fetch;
}

/**
 * Resend: arma el mail con nuestras plantillas y lo manda. La clave idempotente evita que un
 * reintento duplique el envío; en marketing va el header de baja en un clic (RFC 8058).
 */
export class ResendEmailProvider implements EmailProvider {
  readonly id = 'resend';
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ResendOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    const mail = await renderEmail(message, this.options.brand);
    let response: Response;
    try {
      response = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          ...(this.options.replyTo ? { reply_to: this.options.replyTo } : {}),
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          headers: mail.unsubscribeUrl
            ? {
                'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              }
            : undefined,
          tags: [{ name: 'template', value: message.template }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ProviderError(this.id, 'Sin respuesta de Resend', true, { cause: error });
    }
    const text = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        this.id,
        `HTTP ${String(response.status)}: ${text.slice(0, 200)}`,
        response.status >= 500 || response.status === 429,
      );
    }
    const { id } = z.object({ id: z.string() }).parse(JSON.parse(text));
    return { messageId: id };
  }
}
