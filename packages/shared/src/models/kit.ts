import { z } from 'zod';

import { countryCodeSchema } from '../countries';
import { currencySchema } from '../currency';

/**
 * Piezas del kit de cumpleaños (fase 12b). Todas salen del mismo diseño aprobado (la lámina
 * del personaje y las ilustraciones del librito): no se genera nada nuevo por pieza.
 */
export const KIT_PIECES = [
  'mini_book',
  'activities',
  'invitation',
  'thank_you',
  'stickers',
  'favor_tags',
] as const;

export const kitPieceSchema = z.enum(KIT_PIECES);
export type KitPiece = z.infer<typeof kitPieceSchema>;

/** El librito es el diseño: siempre va. */
export const REQUIRED_KIT_PIECES: readonly KitPiece[] = ['mini_book'];

export const KIT_LIMITS = { maxCopies: 200, placeMaxLength: 80, timeMaxLength: 30 } as const;

/** Hoja de impresión: Carta en EE. UU., A4 en el resto. */
export type PaperSize = 'letter' | 'a4';
export const paperFor = (country: string): PaperSize => (country === 'US' ? 'letter' : 'a4');

/** Lo que elige el cliente: piezas, copias autorizadas y los datos de la invitación. */
export const kitSelectionSchema = z.object({
  pieces: z
    .array(
      z.object({
        piece: kitPieceSchema,
        /** Copias que autoriza la licencia (imprimir en casa o en una imprenta local). */
        copies: z.number().int().min(1).max(KIT_LIMITS.maxCopies),
      }),
    )
    .min(1)
    .refine((pieces) => new Set(pieces.map((item) => item.piece)).size === pieces.length, {
      message: 'Pieza repetida',
    })
    .refine(
      (pieces) => REQUIRED_KIT_PIECES.every((piece) => pieces.some((item) => item.piece === piece)),
      {
        message: 'El librito es obligatorio',
      },
    ),
  invitation: z
    .object({
      time: z.string().trim().max(KIT_LIMITS.timeMaxLength).nullable(),
      place: z.string().trim().max(KIT_LIMITS.placeMaxLength).nullable(),
    })
    .nullable()
    .default(null),
});

export type KitSelection = z.infer<typeof kitSelectionSchema>;

/**
 * eventPricing/{país}: precio del diseño (una vez, incluye el librito) y de la licencia
 * digital de cada pieza extra. Las copias no cambian el precio del digital: la licencia dice
 * cuántas se pueden imprimir.
 */
export const eventPricingSchema = z.object({
  country: countryCodeSchema,
  currency: currencySchema,
  active: z.boolean(),
  designMinor: z.number().int().nonnegative(),
  pieces: z.partialRecord(kitPieceSchema, z.number().int().nonnegative()),
  updatedAt: z.date(),
});

export type EventPricing = z.infer<typeof eventPricingSchema>;
