'use client';

import { useTranslations } from 'next-intl';

import { useConsent } from '@/components/consent/consent-provider';

export function CookiePreferencesButton({ className }: { className?: string }) {
  const t = useTranslations('Footer');
  const { openPreferences } = useConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={className ?? 'text-left hover:underline'}
    >
      {t('cookiePreferences')}
    </button>
  );
}
