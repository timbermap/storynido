'use client';

import { useTranslations } from 'next-intl';

import { useConsent } from '@/components/consent/consent-provider';

export function CookiePreferencesButton() {
  const t = useTranslations('Footer');
  const { openPreferences } = useConsent();
  return (
    <button type="button" onClick={openPreferences} className="text-left hover:underline">
      {t('cookiePreferences')}
    </button>
  );
}
