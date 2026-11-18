'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';

import { LOCALES, LOCALE_DEFINITIONS, type CountryCode, type Locale } from '@storynido/shared';

import { useRouter } from '@/i18n/navigation';
import { rememberCountryChoice } from '@/lib/country';
import { CountryOptions } from '@/components/country-options';
import { useSiteCountry } from '@/components/site-country';
import { rememberLocaleChoice } from '@/lib/locale-choice';
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
  const [saved, setSaved] = useState<{ country: CountryCode | null; chosen: boolean } | null>(null);
  // Si la cuenta no eligió país, se muestra el que usa el sitio (el de este navegador o la
  // ubicación), no el que se dedujo al crear la cuenta: así coincide con los precios.
  const siteCountry = useSiteCountry();
  const country = saved ? (saved.chosen ? saved.country : (siteCountry ?? saved.country)) : null;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getFirebaseDb().then((db) => {
      if (!cancelled)
        unsubscribe = subscribePreferences(db, uid, (preferences) => {
          setOptIn(preferences.marketingOptIn);
          setSaved({ country: preferences.country, chosen: preferences.countryChosen });
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
    setSaved({ country: next, chosen: true });
    try {
      await updateUserCountry(await getFirebaseDb(), uid, next);
    } catch {
      setError(true);
      return;
    }
    rememberCountryChoice(next);
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
    rememberLocaleChoice(next);
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
          <CountryOptions locale={locale} current={country ?? undefined} />
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
