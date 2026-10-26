import type { Locale } from '@storynido/shared';

import { brand } from './brand';

/** URL pública del sitio (sin barra final). En local: NEXT_PUBLIC_SITE_URL=http://localhost:3000. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`).replace(
  /\/$/,
  '',
);

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function localeFromParam(value: string): Locale {
  return value as Locale;
}
