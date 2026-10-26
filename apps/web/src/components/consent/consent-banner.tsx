'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import type { Locale } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { LEGAL_SLUGS } from '@/lib/legal';

import { useConsent } from './consent-provider';

/** Banner de cookies y diálogo de preferencias. Analítica y marketing apagados por defecto. */
export function ConsentBanner() {
  const t = useTranslations('Consent');
  const locale = useLocale() as Locale;
  const { choice, preferencesOpen, save, openPreferences, closePreferences } = useConsent();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [analytics, setAnalytics] = useState(choice?.analytics ?? false);
  const [marketing, setMarketing] = useState(choice?.marketing ?? false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (preferencesOpen && !dialog.open) dialog.showModal();
    if (!preferencesOpen && dialog.open) dialog.close();
  }, [preferencesOpen]);

  const policyLink = (
    <Link
      href={{ pathname: '/legal/[document]', params: { document: LEGAL_SLUGS[locale].cookies } }}
      className="underline underline-offset-4"
    >
      {t('policy')}
    </Link>
  );

  return (
    <>
      {choice === null && !preferencesOpen && (
        <section
          aria-label={t('title')}
          className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-xl border bg-card p-5 shadow-lg sm:inset-x-6"
        >
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('text')} {policyLink}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                save({ analytics: true, marketing: true });
              }}
            >
              {t('acceptAll')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                save({ analytics: false, marketing: false });
              }}
            >
              {t('rejectAll')}
            </Button>
            <Button variant="ghost" onClick={openPreferences}>
              {t('customize')}
            </Button>
          </div>
        </section>
      )}

      <dialog
        ref={dialogRef}
        onClose={closePreferences}
        aria-labelledby="consent-title"
        className="m-auto w-[min(100%-2rem,32rem)] rounded-xl border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/40"
      >
        <h2 id="consent-title" className="text-xl font-semibold">
          {t('title')}
        </h2>
        <div className="mt-4 space-y-4">
          <Toggle label={t('necessary')} description={t('necessaryText')} checked disabled />
          <Toggle
            label={t('analytics')}
            description={t('analyticsText')}
            checked={analytics}
            onChange={setAnalytics}
          />
          <Toggle
            label={t('marketing')}
            description={t('marketingText')}
            checked={marketing}
            onChange={setMarketing}
          />
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              save({ analytics: false, marketing: false });
            }}
          >
            {t('rejectAll')}
          </Button>
          <Button
            onClick={() => {
              save({ analytics, marketing });
            }}
          >
            {t('save')}
          </Button>
        </div>
      </dialog>
    </>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 size-5 accent-[var(--primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
