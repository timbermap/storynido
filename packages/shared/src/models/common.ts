import { z } from 'zod';

import { LANGUAGES } from '../i18n';

export const uidSchema = z.string().min(1).max(128);

export const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Texto traducido: una entrada por idioma soportado. */
export function localizedSchema<T extends z.ZodType>(value: T) {
  return z.object(
    Object.fromEntries(LANGUAGES.map((language) => [language, value])) as Record<
      (typeof LANGUAGES)[number],
      T
    >,
  );
}

export const BOOK_FORMATS = ['digital', 'softcover', 'hardcover'] as const;

export const bookFormatSchema = z.enum(BOOK_FORMATS);

export type BookFormat = z.infer<typeof bookFormatSchema>;
