'use client';

import type { CountryCode, Locale } from '@storynido/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE } from '@/lib/country';
import { countriesByName } from '@/lib/country-names';

/**
 * "Enviar a": el país de envío se cambia donde se ven los precios, sin cuenta. El idioma no lo
 * toca (son independientes); la cuenta guarda su propio país en Mi cuenta.
 */
export function ShipToSelect({ country }: { country: CountryCode }) {
  const t = useTranslations('Stories');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
      {t('shipTo')}
      <select
        value={country}
        disabled={pending}
        onChange={(event) => {
          document.cookie = `${COUNTRY_COOKIE}=${event.target.value}; path=/; max-age=${String(COUNTRY_COOKIE_MAX_AGE)}; samesite=lax`;
          startTransition(() => {
            router.refresh();
          });
        }}
        className="h-10 max-w-[16rem] rounded-full border bg-card px-3 font-normal"
      >
        {countriesByName(locale).map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
