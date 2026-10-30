import { BOOK_FORMATS, type EmailTemplate } from '@storynido/shared';
import { z } from 'zod';

const url = z.url();
const title = z.string().min(1);

/** Datos que necesita cada plantilla: un mail nunca sale con datos faltantes. */
export const EMAIL_DATA = {
  welcome: z.object({ name: z.string().nullable(), url }),
  preview_ready: z.object({ childName: z.string().min(1), bookTitle: title, url }),
  draft_reminder: z.object({ childName: z.string().min(1), url, unsubscribeUrl: url }),
  payment_confirmed: z.object({
    bookTitle: title,
    total: z.string().min(1),
    format: z.enum(BOOK_FORMATS),
    url,
  }),
  digital_ready: z.object({ bookTitle: title, url }),
  print_sent: z.object({
    bookTitle: title,
    url,
    etaDaysMin: z.number().int().nonnegative(),
    etaDaysMax: z.number().int().nonnegative(),
  }),
  print_in_production: z.object({ bookTitle: title, url }),
  shipped: z.object({
    bookTitle: title,
    url,
    trackingNumber: z.string().nullable(),
    trackingUrl: url.nullable(),
  }),
  delivered: z.object({ bookTitle: title, url }),
  refunded: z.object({ bookTitle: title, total: z.string().min(1) }),
  cancelled: z.object({ bookTitle: title }),
  data_deleted: z.object({ scope: z.enum(['child', 'account']) }),
  review_request: z.object({ bookTitle: title, url, unsubscribeUrl: url }),
  new_book_suggestion: z.object({
    childName: z.string().nullable(),
    occasion: z.enum(['christmas', 'childrens_day']),
    url,
    unsubscribeUrl: url,
  }),
  admin_alert: z.object({
    kind: z.string().min(1),
    orderId: z.string().nullable(),
    message: z.string().min(1),
    url,
  }),
  contact_message: z.object({
    name: z.string().min(1),
    email: z.email(),
    topic: z.string().min(1),
    message: z.string().min(1),
    locale: z.string(),
    page: z.string().nullable(),
  }),
} satisfies Record<EmailTemplate, z.ZodType>;

export type EmailData<T extends EmailTemplate> = z.infer<(typeof EMAIL_DATA)[T]>;

/** Mails de marketing: solo con consentimiento y siempre con enlace de baja. */
export const MARKETING_TEMPLATES = new Set<EmailTemplate>([
  'draft_reminder',
  'review_request',
  'new_book_suggestion',
]);
