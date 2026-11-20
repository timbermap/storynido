'use client';

import { useCallback } from 'react';

import { AreaPage } from '@/components/areas/area-page';
import { api } from '@/lib/api';
import { attentionFor, sourceName } from '@/lib/area-data';
import { useApi } from '@/lib/use-api';

const nf = new Intl.NumberFormat('es');

/** Marketing: de dónde llega la gente, cuántos crean una muestra y qué palancas de precio hay. */
export default function MarketingSummaryPage() {
  const load = useCallback(
    () =>
      Promise.all([
        api('adminTraffic', { query: { days: 30 } }),
        api('adminAttention'),
        api('adminConfigList', { params: { kind: 'coupons' } }),
        api('adminConfigList', { params: { kind: 'promotions' } }),
      ]),
    [],
  );
  const { data, error } = useApi(load);
  const [traffic, attention, coupons, promotions] = data ?? [];
  const previews = traffic?.funnelBySource.reduce((sum, row) => sum + row.preview_created, 0) ?? 0;
  const purchases = traffic?.funnelBySource.reduce((sum, row) => sum + row.purchase, 0) ?? 0;
  return (
    <AreaPage
      area="Marketing"
      text="Últimos 30 días: de dónde llega la gente y qué palancas de precio hay activas."
      loaded={data !== null}
      error={error}
      attention={attentionFor('Marketing', attention?.items)}
      stats={[
        { label: 'Visitas', value: nf.format(traffic?.totals.views ?? 0) },
        { label: 'Entradas', value: nf.format(traffic?.totals.entries ?? 0) },
        { label: 'Muestras creadas', value: nf.format(previews) },
        { label: 'Compras', value: nf.format(purchases) },
      ]}
      barsTitle="Visitas por fuente"
      bars={(traffic?.sources ?? []).slice(0, 6).map((row) => ({
        label: sourceName(row.key),
        value: row.views,
      }))}
    >
      {data && (
        <p className="text-sm text-muted-foreground">
          Cupones cargados: {nf.format(coupons?.items.length ?? 0)} · Promociones cargadas:{' '}
          {nf.format(promotions?.items.length ?? 0)}
        </p>
      )}
    </AreaPage>
  );
}
