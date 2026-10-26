'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import type { CountryCode } from '@storynido/shared';

import { useRouter } from '@/i18n/navigation';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE } from '@/lib/country';

/** País de envío: define moneda, precios y formatos. Se guarda en una cookie. */
export function CountrySwitcher({
  id,
  current,
  countries,
}: {
  id: string;
  current: CountryCode;
  countries: readonly CountryCode[];
}) {
  const t = useTranslations('Switchers');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = countries.includes(current) ? countries : [current, ...countries];

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('country')}</span>
      <select
        id={id}
        value={current}
        disabled={pending}
        onChange={(event) => {
          document.cookie = `${COUNTRY_COOKIE}=${event.target.value}; path=/; max-age=${String(COUNTRY_COOKIE_MAX_AGE)}; samesite=lax`;
          startTransition(() => {
            router.refresh();
          });
        }}
        className="h-9 rounded-full border bg-card px-3 text-sm font-medium"
      >
        {options.map((code) => (
          <option key={code} value={code}>
            {t(`countries.${code}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
