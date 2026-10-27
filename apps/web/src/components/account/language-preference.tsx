'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { LOCALES, LOCALE_DEFINITIONS, type Locale } from '@storynido/shared';

import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateUserLocale } from '@/lib/firebase/profile';

/**
 * Idioma de la cuenta: el sitio lo detecta solo (idioma del navegador); acá se elige a mano y
 * queda guardado en el perfil y en este dispositivo.
 */
export function LanguagePreference({ uid }: { uid: string }) {
  const t = useTranslations('Account');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

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
      {error && (
        <p role="alert" className="text-destructive text-sm font-semibold">
          {t('preferencesError')}
        </p>
      )}
    </section>
  );
}
