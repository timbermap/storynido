import type { Locale } from '@storynido/shared';

import { Wizard } from '@/components/wizard/wizard';
import type { PriceHint } from '@/components/wizard/types';
import {
  getCollections,
  getEditorial,
  getLessons,
  getOffer,
  getStories,
  getStyles,
} from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string; bookId: string }>;
}

/** El catálogo se carga en el servidor; el borrador, en el cliente (Firestore en vivo). */
export default async function WizardPage({ params }: Props) {
  const { locale: rawLocale, bookId } = await params;
  const locale = rawLocale as Locale;
  const display = await getDisplayCountry(locale);
  const [stories, lessons, styles, editorial, collections, offer] = await Promise.all([
    getStories(locale),
    getLessons(locale),
    getStyles(locale),
    getEditorial(),
    getCollections(locale, 'professionals'),
    getOffer(display.country, locale),
  ]);
  // Precios a la vista mientras se elige (extensión y muestra); se cobra lo que diga el checkout.
  const printed = offer?.formats.filter((format) => format.format !== 'digital') ?? [];
  const prices: PriceHint | null = offer?.available
    ? {
        currency: offer.currency,
        country: display.country,
        digitalMinor:
          offer.formats.find((format) => format.format === 'digital')?.amountMinor ?? null,
        printedFromMinor: printed.length ? Math.min(...printed.map((f) => f.amountMinor)) : null,
      }
    : null;
  return (
    <Wizard
      bookId={bookId}
      catalog={{ stories, lessons, styles, editorial, collections, prices }}
    />
  );
}
