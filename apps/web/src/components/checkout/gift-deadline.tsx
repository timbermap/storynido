'use client';

import { deliveryWindow, giftDeadlineStatus, type Locale } from '@storynido/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * "¿Para qué fecha lo necesitas?" (escenario 22): con los días de envío de la cotización dice si
 * el impreso llega a tiempo. Nunca promete antes de lo posible: cuenta la producción y el peor caso.
 */
export function GiftDeadline({
  etaDaysMin,
  etaDaysMax,
}: {
  etaDaysMin: number;
  etaDaysMax: number;
}) {
  const t = useTranslations('Checkout');
  const locale = useLocale() as Locale;
  const [deadline, setDeadline] = useState('');
  const now = new Date();
  const { earliest, latest } = deliveryWindow(now, etaDaysMin, etaDaysMax);
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      value,
    );
  const status = deadline ? giftDeadlineStatus(deadline, now, etaDaysMin, etaDaysMax) : null;

  return (
    <div className="grid gap-1.5 text-sm">
      <label htmlFor="gift-date" className="font-semibold">
        {t('giftDate')}
      </label>
      <span id="gift-date-hint" className="text-muted-foreground">
        {t('giftDateHint')}
      </span>
      <input
        id="gift-date"
        type="date"
        min={now.toISOString().slice(0, 10)}
        value={deadline}
        aria-describedby="gift-date-hint gift-date-status"
        onChange={(event) => {
          setDeadline(event.target.value);
        }}
        className="h-11 w-full max-w-60 rounded-xl border bg-card px-3"
      />
      <p
        id="gift-date-status"
        role="status"
        className={cn(
          'min-h-5',
          status === 'on_time' && 'text-foreground',
          status === 'at_risk' && 'font-semibold text-foreground',
          status === 'late' && 'font-semibold text-destructive',
        )}
      >
        {status &&
          t(`giftDateStatus.${status}`, { earliest: date(earliest), latest: date(latest) })}
      </p>
    </div>
  );
}
