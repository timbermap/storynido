import { z } from 'zod';

import { countryCodeSchema } from '../countries';

/**
 * Formatos impresos: fotolibros (tapa blanda y tapa dura), el cuento grapado (DECISIONS 138), que
 * cubre los libros cortos que ningún fotolibro imprime (menos de 24 páginas), y la tarjeta 5×7"
 * del kit de Celebraciones (DECISIONS 140).
 */
export const PRINT_FORMATS = ['softcover', 'hardcover', 'booklet', 'card'] as const;

/** Los que son fotolibros (tapa y lomo): Cloudprinter y Lulu solo hacen estos. */
export const PHOTOBOOK_FORMATS = ['softcover', 'hardcover'] as const;
export type PhotobookFormat = (typeof PHOTOBOOK_FORMATS)[number];

export const printFormatSchema = z.enum(PRINT_FORMATS);

export type PrintFormat = z.infer<typeof printFormatSchema>;

/** Fotolibros 210×280 mm vertical (nuestro 21×28 cm), papel de 170 g y laminado mate. */
export const GELATO_PRODUCTS: Record<PrintFormat, string> = {
  softcover:
    'photobooks-softcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_250-gsm-100-lb-cover-coated-silk_ver',
  hardcover:
    'photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver',
  // Cuento grapado A5 vertical (148×210 mm): papel de 115 g y tapa de 250 g, de 8 a 24 páginas.
  booklet:
    'stitched-multi-page-brochures_pf_a5_pt_115-gsm-coated-silk_cl_4-4_bt_stitched-left_cpt_250-gsm-coated-silk_ver',
  // Tarjeta 5R vertical (127×178 mm) a color de los dos lados; en EE. UU. es otro papel.
  card: 'cards_pf_5r_pt_350-gsm-coated-silk_cl_4-4_ver',
};

/** La tarjeta 5R de Gelato en EE. UU. (el papel de 350 g no se imprime ahí). */
export const GELATO_CARD_US = 'cards_pf_5r_pt_130-lb-cover-coated-silk_cl_4-4_ver';

/** Piezas del kit que se pueden imprimir como tarjeta, y las copias mínimas y máximas por pedido. */
export const CARD_PIECES = ['invitation', 'thank_you'] as const;
export type CardPiece = (typeof CARD_PIECES)[number];
export const CARD_COPIES = { min: 10, max: 200 } as const;

/** Fotolibros US Letter vertical (21,6 × 27,9 cm): lo más cercano a nuestro 21×28. */
export const CLOUDPRINTER_PRODUCTS: Record<PhotobookFormat, string> = {
  softcover: 'photobook_pb_us_letter_p_fc',
  hardcover: 'photobook_cw_us_letter_p_fc',
};

/** Lulu: US Letter a color estándar, papel estucado de 80 lb (tapa blanda y tapa dura). */
export const LULU_PRODUCTS: Record<PhotobookFormat, string> = {
  softcover: '0850X1100FCSTDPB080CW444GXX',
  hardcover: '0850X1100FCSTDCW080CW444GXX',
};

/**
 * printOptions/{país}_{formato}_{imprenta}: matriz de impresión. Puede haber varias imprentas por
 * país y formato; cada una imprime solo si está habilitada Y pasó la muestra física
 * (`qaSamplePassed`). Si ninguna puede, el libro queda solo digital.
 */
/** País de una opción de imprenta que sirve para cualquier destino (la imprenta envía al mundo). */
export const ANY_COUNTRY = '*';

export const printOptionSchema = z.object({
  /** País de destino, o `*`: cualquiera (si la imprenta no llega, su cotización falla y queda afuera). */
  country: countryCodeSchema.or(z.literal(ANY_COUNTRY)),
  format: printFormatSchema,
  /** Proveedor (gelato, mock…) y su producto. */
  provider: z.string().min(1),
  sku: z.string().min(1),
  enabled: z.boolean(),
  qaSamplePassed: z.boolean(),
  pages: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    multipleOf: z.number().int().positive(),
  }),
  maxQuantity: z.number().int().positive(),
  /** Plazo de producción + envío que el proveedor garantiza (nunca se promete otro). */
  etaDaysMin: z.number().int().nonnegative(),
  etaDaysMax: z.number().int().nonnegative(),
  /** Costo por ejemplar en centavos de USD (margen). */
  productionCostUsdMinor: z.number().int().nonnegative(),
  updatedAt: z.date(),
});

export type PrintOption = z.infer<typeof printOptionSchema>;

export function printOptionId(country: string, format: string, provider: string): string {
  return `${country}_${format}_${provider}`;
}

/** Rango de páginas del cuento grapado en Gelato (tapas incluidas) y su múltiplo. */
export const BOOKLET_PAGES = { min: 8, max: 24, multipleOf: 4 } as const;

/**
 * Páginas que cuenta la imprenta. En los fotolibros son las del interior; en el cuento grapado
 * entran las dos tapas y el total tiene que ser múltiplo de 4 (se completa con páginas para
 * dibujar).
 */
export function printPageCount(format: string, interiorPages: number): number {
  if (format !== 'booklet') return interiorPages;
  return Math.ceil((interiorPages + 2) / BOOKLET_PAGES.multipleOf) * BOOKLET_PAGES.multipleOf;
}

export type PrintBlock = 'not_offered' | 'sample_pending' | 'pages' | 'quantity';

/** ¿Se puede imprimir este libro (páginas y cantidad) en este país y formato? */
export function printAvailability(
  option: PrintOption | null,
  pages: number,
  quantity: number,
): { ok: true } | { ok: false; reason: PrintBlock } {
  if (!option?.enabled) return { ok: false, reason: 'not_offered' };
  if (!option.qaSamplePassed) return { ok: false, reason: 'sample_pending' };
  const { min, max, multipleOf } = option.pages;
  if (pages < min || pages > max || pages % multipleOf !== 0) return { ok: false, reason: 'pages' };
  if (quantity > option.maxQuantity) return { ok: false, reason: 'quantity' };
  return { ok: true };
}

/**
 * Imprentas que pueden imprimir todos los ítems (formato, páginas y cantidad) en ese país, entre
 * las que están activas en este ambiente. Una imprenta tiene que poder con el pedido entero.
 */
export function printCandidates(
  options: readonly PrintOption[],
  items: readonly { format: string; pages: number; quantity: number }[],
  activeProviders: readonly string[],
): string[] {
  const providers = [...new Set(options.map((option) => option.provider))];
  return providers.filter(
    (provider) =>
      activeProviders.includes(provider) &&
      items.every(
        (item) =>
          printAvailability(
            options.find(
              (option) => option.provider === provider && option.format === item.format,
            ) ?? null,
            item.pages,
            item.quantity,
          ).ok,
      ),
  );
}

export interface RoutedQuote {
  provider: string;
  /** Impresión + envío, en centavos de USD (para comparar imprentas entre sí). */
  totalCostUsdMinor: number;
  etaDaysMin: number;
  etaDaysMax: number;
}

/** Imprentas ordenadas de mejor a peor: menor costo total; si empatan, la que llega antes. */
export function rankPrintQuotes<T extends RoutedQuote>(quotes: readonly T[]): T[] {
  return [...quotes].sort(
    (a, b) =>
      a.totalCostUsdMinor - b.totalCostUsdMinor ||
      a.etaDaysMax - b.etaDaysMax ||
      a.provider.localeCompare(b.provider),
  );
}

/** Lo que el pedido guarda de la elección de imprenta (para el worker y para el admin). */
export const printRoutingSchema = z.object({
  provider: z.string(),
  totalCostUsdMinor: z.number().int().nonnegative(),
  /** Impresión y envío por separado (el envío se cobra al costo; DECISIONS 096). */
  productionCostUsdMinor: z.number().int().nonnegative().optional(),
  shippingCostUsdMinor: z.number().int().nonnegative().optional(),
  etaDaysMin: z.number().int().nonnegative(),
  etaDaysMax: z.number().int().nonnegative(),
  /** Todas las cotizaciones, ordenadas; las que fallaron quedan con el error. */
  quotes: z.array(
    z.object({
      provider: z.string(),
      totalCostUsdMinor: z.number().int().nonnegative().nullable(),
      etaDaysMax: z.number().int().nonnegative().nullable(),
      error: z.string().nullable(),
    }),
  ),
  quotedAt: z.date(),
});

export type PrintRouting = z.infer<typeof printRoutingSchema>;
