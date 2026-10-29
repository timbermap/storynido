import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { Markdown } from '@/components/markdown';
import { ShipToSelect } from '@/components/stories/ship-to-select';
import { countryName } from '@/lib/country-names';
import { formatDate } from '@/lib/format';
import { LEGAL_SLUGS, legalDocumentFromSlug } from '@/lib/legal';
import { localizedAlternates } from '@/lib/seo';
import { getContent, getOffer } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string; document: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, document } = await params;
  const locale = rawLocale as Locale;
  const doc = legalDocumentFromSlug(locale, document);
  if (!doc) return {};
  const t = await getTranslations({ locale, namespace: 'Legal' });
  return {
    title: t(doc),
    alternates: localizedAlternates(locale, (target) => ({
      pathname: '/legal/[document]',
      params: { document: LEGAL_SLUGS[target][doc] },
    })),
  };
}

export default async function LegalPage({ params }: Props) {
  const { locale: rawLocale, document } = await params;
  const locale = rawLocale as Locale;
  const doc = legalDocumentFromSlug(locale, document);
  if (!doc) notFound();

  const [content, t, display] = await Promise.all([
    getContent(doc, locale),
    getTranslations('Legal'),
    getDisplayCountry(locale),
  ]);
  if (!content) notFound();
  // Envíos: qué se puede pedir en el país elegido (el mismo dato que usa el checkout).
  const offer = doc === 'shipping' ? await getOffer(display.country, locale) : null;
  const printed = offer?.formats.filter((format) => format.format !== 'digital') ?? [];

  return (
    <article className="container-page max-w-3xl py-14">
      <h1 className="text-4xl font-medium">{content.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('updated', { date: formatDate(content.updatedAt, locale, display.country) })}
      </p>
      {doc === 'shipping' && (
        <section aria-labelledby="ship-check" className="mt-8 rounded-xl border bg-card p-6">
          <h2 id="ship-check" className="text-xl font-medium">
            {t('shipCheckTitle')}
          </h2>
          <ShipToSelect country={display.country} />
          <ul className="mt-4 grid gap-2 text-sm">
            <li>
              {offer?.available && offer.formats.some((format) => format.format === 'digital')
                ? t('shipDigital')
                : t('shipNone', { country: countryName(display.country, locale) })}
            </li>
            {offer?.available && (
              <li>
                {printed.length > 0
                  ? t('shipPrinted', {
                      formats: printed.map((format) => format.name).join(', '),
                      min: offer.shipping.etaDaysMin,
                      max: offer.shipping.etaDaysMax,
                    })
                  : t('shipNoPrint')}
              </li>
            )}
          </ul>
        </section>
      )}
      <Markdown className="mt-8">{content.body}</Markdown>
    </article>
  );
}
