'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { BookFormat, CountryCode, Locale, Offer, PriceSnapshot } from '@storynido/shared';

import { countryName } from '@/lib/country-names';
import { formatPrice, localReference } from '@/lib/format';

/** Resumen del precio tal como lo calculó el servidor (cada componente y el total). */
export function PriceSummary({
  snapshot,
  country,
  local = null,
  format = null,
  shipTo = null,
}: {
  snapshot: PriceSnapshot;
  country: CountryCode;
  /** Moneda local de referencia (todo se cobra en dólares). */
  local?: Offer['local'];
  /** Formato pedido: la fila del libro dice cuál es («Cuento grapado») en vez de «Libro». */
  format?: BookFormat | null;
  /** Impreso: país de envío (el envío va en su propio renglón, «Envío a México»). */
  shipTo?: CountryCode | null;
}) {
  const t = useTranslations('Checkout');
  const locale = useLocale() as Locale;
  const componentLabel = (code: PriceSnapshot['components'][number]['code']) =>
    code === 'book' && format ? t(`formats.${format}.name`) : t(`component.${code}`);
  const money = (minor: number) => formatPrice(minor, snapshot.currency, locale, country);
  const rows: { label: string; value: string; muted?: boolean }[] = snapshot.components.map(
    (component) => ({
      label:
        component.code === 'piece' && component.piece
          ? t(`kit.pieces.${component.piece}.name`)
          : component.quantity > 1
            ? `${componentLabel(component.code)} × ${String(component.quantity)}`
            : componentLabel(component.code),
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
  const destination = shipTo ? countryName(shipTo, locale) : null;
  if (snapshot.shipping.pending) {
    // Impreso sin dirección: el envío se cotiza al completarla (no está en el total).
    rows.push({
      label: destination ? t('shippingToPending', { country: destination }) : t('shippingPending'),
      value: '—',
      muted: true,
    });
  } else {
    const eta = { min: snapshot.shipping.etaDaysMin, max: snapshot.shipping.etaDaysMax };
    rows.push({
      label:
        snapshot.shipping.minor > 0
          ? destination
            ? t('shippingTo', { country: destination, ...eta })
            : t('shippingEta', eta)
          : t('shippingDigital'),
      value: snapshot.shipping.minor > 0 ? money(snapshot.shipping.minor) : t('free'),
    });
  }
  // Sin impuesto configurado (y no incluido), la fila no aporta nada.
  if (snapshot.tax.included || snapshot.tax.minor > 0)
    rows.push({
      label: snapshot.tax.included
        ? t('taxIncluded', { rate: snapshot.tax.basisPoints / 100 })
        : t('tax', { rate: snapshot.tax.basisPoints / 100 }),
      value: money(snapshot.tax.minor),
      muted: snapshot.tax.included,
    });

  const reference =
    snapshot.currency === 'USD'
      ? localReference(snapshot.totalMinor, local, locale, country)
      : null;

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
      {reference && (
        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <dt>{t('localReference')}</dt>
          <dd className="tabular-nums">{reference}</dd>
        </div>
      )}
    </dl>
  );
}
