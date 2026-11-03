import type { Locale } from '@storynido/shared';

import type { PriceHint, WizardData } from '@/components/wizard/types';

import { offerPrices } from '@/components/wizard/party';

import {
  getCollections,
  getEditorial,
  getEventPricing,
  getLessons,
  getOffer,
  getStories,
  getStyles,
} from './api';
import { getDisplayCountry } from './request-context';

export type WizardCatalog = Pick<
  WizardData,
  | 'stories'
  | 'lessons'
  | 'styles'
  | 'editorial'
  | 'collections'
  | 'prices'
  | 'eventThemes'
  | 'eventPrices'
>;

/** Lo que el creador necesita del catálogo, cargado en el servidor (el borrador va por Firestore). */
export async function loadWizardCatalog(locale: Locale): Promise<WizardCatalog> {
  const display = await getDisplayCountry(locale);
  const [stories, lessons, styles, editorial, collections, eventThemes, eventPricing, offer] =
    await Promise.all([
      getStories(locale),
      getLessons(locale),
      getStyles(locale),
      getEditorial(),
      getCollections(locale, 'professionals'),
      getCollections(locale, 'events'),
      getEventPricing(display.country),
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
  const eventPrices = eventPricing
    ? {
        currency: eventPricing.currency,
        country: display.country,
        ...offerPrices(eventPricing),
      }
    : null;
  return { stories, lessons, styles, editorial, collections, prices, eventThemes, eventPrices };
}
