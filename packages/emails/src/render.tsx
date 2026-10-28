import { render } from '@react-email/components';
import type { EmailMessage } from '@storynido/shared';

import type { EmailBrand } from './brand';
import { COPY, type EmailCopy } from './copy';
import { EMAIL_DATA, MARKETING_TEMPLATES } from './data';
import { EmailLayout } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** Solo en marketing: va también en el header List-Unsubscribe. */
  unsubscribeUrl: string | null;
}

/** Arma el mail en el idioma pedido. Falla si a la plantilla le faltan datos. */
export async function renderEmail(
  message: EmailMessage,
  brand: EmailBrand,
): Promise<RenderedEmail> {
  const data: unknown = EMAIL_DATA[message.template].parse(message.data);
  const locale = COPY[message.locale];
  const build = locale.templates[message.template] as (input: unknown) => EmailCopy;
  const copy = build(data);
  const unsubscribeUrl = MARKETING_TEMPLATES.has(message.template)
    ? (data as { unsubscribeUrl: string }).unsubscribeUrl
    : null;
  const element = (
    <EmailLayout
      locale={message.locale}
      brand={brand}
      copy={copy}
      footer={locale.footer}
      unsubscribeUrl={unsubscribeUrl}
    />
  );
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: copy.subject, html, text, unsubscribeUrl };
}
