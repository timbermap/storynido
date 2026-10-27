'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { CountryCode, Locale, PriceSnapshot } from '@storynido/shared';

import { formatPrice } from '@/lib/format';

/** Resumen del precio tal como lo calculó el servidor (cada componente y el total). */
export function PriceSummary({
  snapshot,
  country,
}: {
  snapshot: PriceSnapshot;
  country: CountryCode;
}) {
  const t = useTranslations('Checkout');
  const locale = useLocale() as Locale;
  const money = (minor: number) => formatPrice(minor, snapshot.currency, locale, country);
  const rows: { label: string; value: string; muted?: boolean }[] = snapshot.components.map(
    (component) => ({
      label:
        component.quantity > 1
          ? `${t(`component.${component.code}`)} × ${String(component.quantity)}`
          : t(`component.${component.code}`),
      value: money(component.totalMinor),
    }),
  );
  if (snapshot.discount.minor > 0) {
    rows.push({
      label: t(`discount.${snapshot.discount.reason ?? 'coupon'}`, {
        label: snapshot.discount.label ?? '',
      }),
      value: `−${money(snapshot.discount.minor)}`,
    });
  }
  rows.push({
    label:
      snapshot.shipping.minor > 0
        ? t('shippingEta', {
            min: snapshot.shipping.etaDaysMin,
            max: snapshot.shipping.etaDaysMax,
          })
        : t('shippingDigital'),
    value: snapshot.shipping.minor > 0 ? money(snapshot.shipping.minor) : t('free'),
  });
  // Sin impuesto configurado (y no incluido), la fila no aporta nada.
  if (snapshot.tax.included || snapshot.tax.minor > 0)
    rows.push({
      label: snapshot.tax.included
        ? t('taxIncluded', { rate: snapshot.tax.basisPoints / 100 })
        : t('tax', { rate: snapshot.tax.basisPoints / 100 }),
      value: money(snapshot.tax.minor),
      muted: snapshot.tax.included,
    });

  return (
    <dl className="grid gap-2.5 text-sm">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`flex justify-between gap-4 ${row.muted ? 'text-muted-foreground' : ''}`}
        >
          <dt>{row.label}</dt>
          <dd className="tabular-nums">{row.value}</dd>
        </div>
      ))}
      <div className="mt-2 flex justify-between gap-4 border-t pt-3 text-base font-bold">
        <dt>{t('total')}</dt>
        <dd className="tabular-nums">{money(snapshot.totalMinor)}</dd>
      </div>
    </dl>
  );
}
