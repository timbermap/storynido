import { EMAIL_TEMPLATES, LOCALES } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { DEFAULT_BRAND } from './brand';
import { MARKETING_TEMPLATES } from './data';
import { renderEmail } from './render';
import { SAMPLE_DATA } from './samples';

describe('plantillas de mail', () => {
  it.each(
    EMAIL_TEMPLATES.flatMap((template) => LOCALES.map((locale) => [template, locale] as const)),
  )('%s en %s: asunto, HTML y texto', async (template, locale) => {
    const mail = await renderEmail(
      { to: 'ana@example.com', template, locale, data: SAMPLE_DATA[template], idempotencyKey: 'k' },
      DEFAULT_BRAND,
    );
    expect(mail.subject.length).toBeGreaterThan(5);
    expect(mail.html).toContain(`lang="${locale}"`);
    expect(mail.text.length).toBeGreaterThan(40);
    // Marketing siempre lleva baja; los transaccionales no.
    expect(mail.unsubscribeUrl !== null).toBe(MARKETING_TEMPLATES.has(template));
    if (mail.unsubscribeUrl) expect(mail.html).toContain('unsubscribe');
  });

  it('se escribe en el idioma del cliente', async () => {
    const base = {
      to: 'ana@example.com',
      template: 'shipped' as const,
      data: SAMPLE_DATA.shipped,
      idempotencyKey: 'k',
    };
    const [es, en, pt] = await Promise.all(
      (['es', 'en', 'pt'] as const).map((locale) =>
        renderEmail({ ...base, locale }, DEFAULT_BRAND),
      ),
    );
    expect(es?.subject).toContain('va en camino');
    expect(en?.subject).toContain('is on its way');
    expect(pt?.subject).toContain('está a caminho');
    expect(es?.text).toContain('9400111899223');
  });

  it('una plantilla con datos faltantes no se manda', async () => {
    await expect(
      renderEmail(
        {
          to: 'ana@example.com',
          template: 'review_request',
          locale: 'es',
          data: { bookTitle: 'X' },
          idempotencyKey: 'k',
        },
        DEFAULT_BRAND,
      ),
    ).rejects.toThrow();
  });
});
