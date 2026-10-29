import { Info } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { countryName } from '@/lib/country-names';
import type { DisplayCountry } from '@/lib/server/request-context';

/** Aviso cuando el país del visitante todavía no está disponible y se muestran precios de otro. */
export async function CountryNotice({ display }: { display: DisplayCountry }) {
  if (!display.fallback) return null;
  const [t, locale] = await Promise.all([
    getTranslations('Stories'),
    getLocale() as Promise<Locale>,
  ]);
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {t('fallbackNotice', {
        preferred: countryName(display.preferred, locale),
        country: countryName(display.country, locale),
      })}
    </p>
  );
}
