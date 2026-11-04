import { z } from 'zod';

import { countryCodeSchema, type CountryCode } from '../countries';
import type { CountryConfig } from './commerce';
import { bookFormatSchema, type BookFormat } from './common';
import { BOOK_LENGTHS, bookLengthSchema, type EditorialConfig } from './editorial';
import type { FxRates } from './metrics';
import { printCandidates, printPageCount, type PrintOption } from './print';
import { quote, type ProDiscountConfig } from './pricing';
import { marginUsdMinor, type ProductPricing } from './product-pricing';

/** Por qué una combinación país × formato × extensión no se vende. */
export const PRICE_TABLE_BLOCKS = [
  'country_off',
  'format_off',
  'not_for_length',
  'no_printer',
  'price_missing',
] as const;

/** Una fila de la tabla «Precio final» del admin: de dónde sale cada precio, en centavos de USD. */
export const priceTableRowSchema = z.object({
  country: countryCodeSchema,
  format: bookFormatSchema,
  length: bookLengthSchema,
  /** Páginas interiores de la extensión (las que pagan IA). */
  pages: z.number().int(),
  /** Páginas que cuenta la imprenta (el grapado suma tapas y cierra en múltiplo de 4). */
  printPages: z.number().int(),
  aiCostUsdMinor: z.number().int(),
  creationMarginUsdMinor: z.number().int(),
  /** Imprenta más barata que puede (la del pago se elige con la dirección). */
  provider: z.string().nullable(),
  productionCostUsdMinor: z.number().int(),
  printMarginUsdMinor: z.number().int(),
  /** Precio del libro (sin envío ni impuesto agregado), con el redondeo a ,99 del checkout. */
  priceMinor: z.number().int().nullable(),
  /** Lo mismo con el descuento base del perfil profesional. */
  proPriceMinor: z.number().int().nullable(),
  blocked: z.enum(PRICE_TABLE_BLOCKS).nullable(),
});

export type PriceTableRow = z.infer<typeof priceTableRowSchema>;

/**
 * Tabla «Precio final» (país × formato × extensión). El precio sale de `quote`, la misma función
 * que cotiza el checkout, sin cupón ni promoción; el impreso usa la imprenta más barata que puede
 * imprimir esas páginas, como la estimación del pago sin dirección.
 */
export function buildPriceTable(input: {
  countries: readonly CountryConfig[];
  pricing: Record<BookFormat, ProductPricing>;
  editorial: EditorialConfig;
  printOptions: (country: CountryCode) => readonly PrintOption[];
  activePrinters: readonly string[];
  proDiscounts: ProDiscountConfig;
  fx: FxRates;
  now: Date;
}): PriceTableRow[] {
  const rows: PriceTableRow[] = [];
  for (const country of input.countries) {
    const options = input.printOptions(country.code);
    for (const length of BOOK_LENGTHS) {
      const config = input.editorial.lengths[length];
      const pages = config.interiorPages;
      for (const format of bookFormatSchema.options) {
        const pricing = input.pricing[format];
        const printPages = printPageCount(format, pages);
        const ai = pricing.aiCostPerPageUsdMinor * pages;
        // La imprenta más barata entre las que pueden con estas páginas.
        const usable =
          format === 'digital'
            ? []
            : options.filter(
                (option) =>
                  option.format === format &&
                  printCandidates(
                    [option],
                    [{ format, pages: printPages, quantity: 1 }],
                    input.activePrinters,
                  ).length > 0,
              );
        const cheapest = [...usable].sort(
          (a, b) => a.productionCostUsdMinor - b.productionCostUsdMinor,
        )[0];
        const production = cheapest?.productionCostUsdMinor ?? 0;
        const blocked = !country.active
          ? 'country_off'
          : !country.formats[format] || !pricing.active
            ? 'format_off'
            : !config.formats.includes(format)
              ? 'not_for_length'
              : format !== 'digital' && !cheapest
                ? 'no_printer'
                : null;
        const price = (professional: boolean) => {
          if (blocked) return null;
          const result = quote({
            country,
            pricing,
            fx: input.fx,
            format,
            pages,
            quantity: 1,
            print: cheapest
              ? {
                  productionUsdMinor: cheapest.productionCostUsdMinor,
                  shippingUsdMinor: null,
                  etaDaysMin: cheapest.etaDaysMin,
                  etaDaysMax: cheapest.etaDaysMax,
                }
              : null,
            coupon: null,
            couponCode: null,
            promotions: [],
            now: input.now,
            pro: professional
              ? { purchases: 0, config: input.proDiscounts, professional: true }
              : null,
          });
          if (!result.ok) return null;
          return result.snapshot.components.find((item) => item.code === 'book')?.unitMinor ?? null;
        };
        const priceMinor = price(false);
        rows.push({
          country: country.code,
          format,
          length,
          pages,
          printPages,
          aiCostUsdMinor: ai,
          creationMarginUsdMinor: marginUsdMinor(pricing.creationMargin, ai),
          provider: cheapest?.provider ?? null,
          productionCostUsdMinor: production,
          printMarginUsdMinor: cheapest ? marginUsdMinor(pricing.printMargin, production) : 0,
          priceMinor,
          proPriceMinor: price(true),
          blocked: blocked ?? (priceMinor === null ? 'price_missing' : null),
        });
      }
    }
  }
  return rows;
}
