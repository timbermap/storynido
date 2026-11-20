'use client';

import { useCallback } from 'react';

import { AreaPage } from '@/components/areas/area-page';
import { usd } from '@/components/dashboard/today';
import { api } from '@/lib/api';
import { attentionFor } from '@/lib/area-data';
import { useApi } from '@/lib/use-api';

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });
const country = (code: string) => {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Administración: ventas, comisión de cobro, contribución y reembolsos del período. */
export default function AdministrationSummaryPage() {
  const load = useCallback(
    () =>
      Promise.all([
        api('adminMetrics', { query: { days: 30, compare: 'false' } }),
        api('adminAttention'),
      ]),
    [],
  );
  const { data, error } = useApi(load);
  const [metrics, attention] = data ?? [];
  const totals = metrics?.totals;
  return (
    <AreaPage
      area="Administración"
      text="Últimos 30 días: ventas, cobros, precios y márgenes."
      loaded={data !== null}
      error={error}
      attention={attentionFor('Administración', attention?.items)}
      stats={[
        {
          label: 'Ventas',
          value: usd(totals?.revenueUsd ?? 0),
          hint: `${String(totals?.orders ?? 0)} pedidos`,
        },
        { label: 'Comisión de cobro', value: usd(totals?.paymentFeeUsd ?? 0) },
        { label: 'Contribución', value: usd(totals?.contributionUsd ?? 0) },
        {
          label: 'Reembolsos',
          value: usd(totals?.refundedUsd ?? 0),
          hint: `${String(totals?.refunds ?? 0)} pedidos`,
        },
      ]}
      barsTitle="Ventas por país (US$)"
      bars={Object.entries(totals?.revenueUsdByCountry ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([code, value]) => ({ label: country(code), value, text: usd(value) }))}
    />
  );
}
