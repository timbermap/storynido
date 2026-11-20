'use client';

import Link from 'next/link';
import { useCallback } from 'react';

import { AreaPage } from '@/components/areas/area-page';
import { Card } from '@/components/ui/page-header';
import { usd } from '@/components/dashboard/today';
import { api } from '@/lib/api';
import { attentionFor } from '@/lib/area-data';
import { useApi } from '@/lib/use-api';

const IN_PROCESS = ['generating', 'qa_failed', 'sent_to_print', 'in_production', 'shipped'];
const STATUS_LABELS: Record<string, string> = {
  generating: 'Generando',
  qa_failed: 'En revisión',
  sent_to_print: 'En la imprenta',
  in_production: 'Imprimiendo',
  shipped: 'Enviados',
};

/** Operaciones: la cola de revisión, el control de calidad, las imprentas y el gasto de IA. */
export default function OperationsSummaryPage() {
  const load = useCallback(async () => {
    const result = await Promise.all([
      api('adminReviewQueue'),
      api('adminAiConfig'),
      api('adminInsights', { query: { days: 30 } }),
      api('adminOrders', { query: { limit: 100 } }),
      api('adminAttention'),
    ]);
    return [...result, Date.now()] as const;
  }, []);
  const { data, error } = useApi(load);
  const [queue, ai, insights, orders, attention, now = 0] = data ?? [];
  const oldest = (queue?.orders ?? [])
    .map((order) => order.createdAt)
    .filter((at): at is string => at !== null)
    .sort()[0];
  const waitH = oldest ? Math.round((now - new Date(oldest).getTime()) / 3_600_000) : 0;
  const printFailed = (insights?.print ?? []).reduce((sum, row) => sum + row.failed, 0);
  const counts = new Map<string, number>();
  for (const order of orders?.orders ?? [])
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  return (
    <AreaPage
      area="Operaciones"
      text="Producción, calidad, imprentas y el motor de IA."
      loaded={data !== null}
      error={error}
      attention={attentionFor('Operaciones', attention?.items)}
      stats={[
        { label: 'En revisión manual', value: String(queue?.orders.length ?? 0) },
        { label: 'Espera más antigua', value: oldest ? `${String(waitH)} h` : '—' },
        {
          label: 'IA gastada hoy',
          value: usd(ai?.spentTodayUsd ?? 0),
          hint: `Tope diario ${usd(ai?.config.dailyBudgetUsd ?? 0)}`,
        },
        { label: 'Fallas de impresión 30 d', value: String(printFailed) },
      ]}
      barsTitle="Pedidos en proceso (últimos 100)"
      bars={IN_PROCESS.map((status) => ({
        label: STATUS_LABELS[status] ?? status,
        value: counts.get(status) ?? 0,
      }))}
    >
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Calidad (30 días)</h2>
        <ul className="grid gap-1 text-sm">
          {(insights?.quality ?? []).map((row) => (
            <li key={row.metric} className="flex justify-between gap-3">
              <span>{row.metric}</span>
              <span className="text-muted-foreground tabular-nums">
                {row.value === null
                  ? '—'
                  : `${(row.value * 100).toLocaleString('es', { maximumFractionDigits: 1 })} %`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link href="/orders" className="text-primary underline-offset-4 hover:underline">
            Ver todos los pedidos (Administración)
          </Link>
        </p>
      </Card>
    </AreaPage>
  );
}
