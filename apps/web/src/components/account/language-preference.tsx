'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';

import { LOCALES, LOCALE_DEFINITIONS, type CountryCode, type Locale } from '@storynido/shared';

import { useRouter } from '@/i18n/navigation';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE } from '@/lib/country';
import { countriesByName } from '@/lib/country-names';
import { getFirebaseDb } from '@/lib/firebase/client';
import {
  subscribePreferences,
  updateMarketingOptIn,
  updateUserCountry,
  updateUserLocale,
} from '@/lib/firebase/profile';

/**
 * Idioma y país de la cuenta: el sitio los detecta solos (por la ubicación); acá se eligen a mano
 * y quedan guardados en el perfil y en este dispositivo.
 */
export function LanguagePreference({ uid }: { uid: string }) {
  const t = useTranslations('Account');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [country, setCountry] = useState<CountryCode | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getFirebaseDb().then((db) => {
      if (!cancelled)
        unsubscribe = subscribePreferences(db, uid, (preferences) => {
          setOptIn(preferences.marketingOptIn);
          setCountry(preferences.country);
        });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid]);

  async function toggleNews(next: boolean) {
    setError(false);
    setOptIn(next);
    try {
      await updateMarketingOptIn(await getFirebaseDb(), uid, next);
    } catch {
      setError(true);
    }
  }

  async function changeCountry(next: CountryCode) {
    setError(false);
    setCountry(next);
    try {
      await updateUserCountry(await getFirebaseDb(), uid, next);
    } catch {
      setError(true);
      return;
    }
    document.cookie = `${COUNTRY_COOKIE}=${next}; path=/; max-age=${String(COUNTRY_COOKIE_MAX_AGE)}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  async function change(next: Locale) {
    setError(false);
    try {
      await updateUserLocale(await getFirebaseDb(), uid, next);
    } catch {
      setError(true);
      return;
    }
    startTransition(() => {
      router.replace('/account', { locale: next });
    });
  }

  return (
    <section
      id="preferences"
      aria-labelledby="preferences-title"
      className="grid scroll-mt-28 gap-3 rounded-2xl border bg-card p-5"
    >
      <h2 id="preferences-title" className="text-xl font-medium">
        {t('preferencesTitle')}
      </h2>
      <label htmlFor="account-language" className="grid gap-1.5 text-sm">
        <span className="font-semibold">{t('language')}</span>
        <select
          id="account-language"
          value={locale}
          disabled={pending}
          onChange={(event) => void change(event.target.value as Locale)}
          className="h-11 max-w-xs rounded-xl border bg-card px-3 text-base"
        >
          {LOCALES.map((code) => (
            <option key={code} value={code} lang={LOCALE_DEFINITIONS[code].bcp47}>
              {LOCALE_DEFINITIONS[code].label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">{t('languageNote')}</p>
      <label htmlFor="account-country" className="mt-2 grid gap-1.5 text-sm">
        <span className="font-semibold">{t('country')}</span>
        <select
          id="account-country"
          value={country ?? ''}
          disabled={pending || country === null}
          onChange={(event) => void changeCountry(event.target.value as CountryCode)}
          className="h-11 max-w-xs rounded-xl border bg-card px-3 text-base"
        >
          {country === null && <option value="" />}
          {countriesByName(locale).map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted-foreground">{t('countryNote')}</p>
      <label className="mt-2 flex items-start gap-3 text-sm">
        <input
          id="account-news"
          type="checkbox"
          checked={optIn ?? false}
          disabled={optIn === null}
          onChange={(event) => void toggleNews(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="font-semibold">{t('news')}</span>
          <span className="block text-muted-foreground">{t('newsNote')}</span>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {t('preferencesError')}
        </p>
      )}
    </section>
  );
}
