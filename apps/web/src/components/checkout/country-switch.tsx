'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import type { CountryCode, Locale } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { CountryOptions } from '@/components/country-options';
import { forgetCountryChoice, rememberCountryChoice } from '@/lib/country';
import { countryName } from '@/lib/country-names';

/** Valor del select para "según mi ubicación" (no es un país). */
const AUTO = 'auto';

/**
 * País de los precios, a la vista junto al total: se cambia acá mismo o se vuelve al de la
 * ubicación. Con sesión iniciada queda también en la cuenta (manda en todos sus dispositivos).
 */
export function CountrySwitch({
  country,
  detected,
  chosen,
}: {
  country: CountryCode;
  detected: CountryCode;
  chosen: boolean;
}) {
  const t = useTranslations('Checkout.countrySwitch');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user, signedIn } = useAuth();
  const [pending, startTransition] = useTransition();

  async function change(value: string) {
    const auto = value === AUTO;
    if (auto) forgetCountryChoice();
    else rememberCountryChoice(value as CountryCode);
    if (signedIn && user) {
      try {
        const [{ getFirebaseDb }, profile] = await Promise.all([
          import('@/lib/firebase/client'),
          import('@/lib/firebase/profile'),
        ]);
        const db = await getFirebaseDb();
        if (auto) await profile.clearUserCountryChoice(db, user.uid, detected);
        else await profile.updateUserCountry(db, user.uid, value as CountryCode);
      } catch {
        // La cuenta no se pudo actualizar: igual vale para este navegador.
      }
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <label
      htmlFor="checkout-country"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
    >
      <span>{t('label')}</span>
      <select
        id="checkout-country"
        value={chosen ? country : AUTO}
        disabled={pending}
        onChange={(event) => void change(event.target.value)}
        className="h-8 max-w-[14rem] rounded-full border bg-card px-2.5 text-xs font-semibold text-foreground"
      >
        <option value={AUTO}>{t('auto', { country: countryName(detected, locale) })}</option>
        <CountryOptions locale={locale} current={chosen ? country : undefined} />
      </select>
      {chosen && country !== detected && (
        <span className="basis-full">
          {t('chosenNote', { country: countryName(detected, locale) })}
        </span>
      )}
    </label>
  );
}
