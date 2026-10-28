import type { Locale } from '../i18n';

export const EMAIL_TEMPLATES = [
  'welcome',
  'preview_ready',
  'draft_reminder',
  'payment_confirmed',
  'digital_ready',
  'print_sent',
  'print_in_production',
  'shipped',
  'delivered',
  'refunded',
  'cancelled',
  'data_deleted',
  'review_request',
  'new_book_suggestion',
  'admin_alert',
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface EmailMessage {
  to: string;
  template: EmailTemplate;
  locale: Locale;
  data: Readonly<Record<string, unknown>>;
  /** Evita mandar dos veces el mismo mail (por ejemplo `order-123:shipped`). */
  idempotencyKey: string;
}

export interface EmailProvider {
  readonly id: string;
  send(message: EmailMessage): Promise<{ messageId: string }>;
  /** Prueba de conexión del admin (sin mandar mails). */
  check?(): Promise<string>;
}
