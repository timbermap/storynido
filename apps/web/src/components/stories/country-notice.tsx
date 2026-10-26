import { Info } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { DisplayCountry } from '@/lib/server/request-context';

/** Aviso cuando el país del visitante todavía no está disponible y se muestran precios de otro. */
export async function CountryNotice({ display }: { display: DisplayCountry }) {
  if (!display.fallback) return null;
  const [t, tSwitch] = await Promise.all([
    getTranslations('Stories'),
    getTranslations('Switchers'),
  ]);
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {t('fallbackNotice', {
        preferred: tSwitch(`countries.${display.preferred}`),
        country: tSwitch(`countries.${display.country}`),
      })}
    </p>
  );
}
