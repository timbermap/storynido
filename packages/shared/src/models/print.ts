import { z } from 'zod';

import { countryCodeSchema } from '../countries';

export const PRINT_FORMATS = ['softcover', 'hardcover'] as const;

export const printFormatSchema = z.enum(PRINT_FORMATS);

export type PrintFormat = z.infer<typeof printFormatSchema>;

/**
 * printOptions/{país}_{formato}_{imprenta}: matriz de impresión. Puede haber varias imprentas por
 * país y formato; cada una imprime solo si está habilitada Y pasó la muestra física
 * (`qaSamplePassed`). Si ninguna puede, el libro queda solo digital.
 */
export const printOptionSchema = z.object({
  country: countryCodeSchema,
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
