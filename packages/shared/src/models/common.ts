import { z } from 'zod';

import { LOCALES } from '../i18n';

export const uidSchema = z.string().min(1).max(128);

export const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Texto traducido: una entrada por idioma soportado. */
export function localizedSchema<T extends z.ZodType>(value: T) {
  return z.object(
    Object.fromEntries(LOCALES.map((locale) => [locale, value])) as Record<
      (typeof LOCALES)[number],
      T
    >,
  );
}

export const BOOK_FORMATS = ['digital', 'softcover', 'hardcover'] as const;

export const bookFormatSchema = z.enum(BOOK_FORMATS);

export type BookFormat = z.infer<typeof bookFormatSchema>;
