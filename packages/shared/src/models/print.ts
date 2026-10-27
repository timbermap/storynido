import { z } from 'zod';

import { countryCodeSchema } from '../countries';

export const PRINT_FORMATS = ['softcover', 'hardcover'] as const;

export const printFormatSchema = z.enum(PRINT_FORMATS);

export type PrintFormat = z.infer<typeof printFormatSchema>;

/**
 * printOptions/{país}_{formato}: matriz de impresión. Un formato se imprime en un país solo si
 * está habilitado Y pasó la muestra física (`qaSamplePassed`). Lo que no, queda solo digital.
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

export function printOptionId(country: string, format: string): string {
  return `${country}_${format}`;
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
