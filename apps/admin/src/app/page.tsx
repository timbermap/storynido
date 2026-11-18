'use client';

import type { AttentionItem } from '@storynido/shared';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { DailyBars } from '@/components/dashboard/daily-bars';
import {
  AttentionCard,
  ContributionWaterfall,
  FunnelByLine,
  KpiRow,
  ProductTable,
  StyleTable,
  usd,
} from '@/components/dashboard/today';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { SITE_MODE_INFO } from '@/lib/site-modes';
import { errorMessage, useApi } from '@/lib/use-api';

const RANGES = [7, 30, 90] as const;

/**
 * Hoy: lo que necesita atención, los cuatro números contra el período anterior, de la venta a
 * la contribución, por producto y el embudo por línea. Abajo, el detalle por día y por país.
 */
export default function TodayPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [table, setTable] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      Promise.all([
        api('adminSiteConfig'),
        api('adminAiConfig'),
        api('adminMetrics', { query: { days, compare: 'true' } }),
        api('adminAttention'),
      ]),
    [days],
  );
  const { data, error, reload } = useApi(load);
  const [site, ai, metrics, attention] = data ?? [];
  const totals = metrics?.totals;
  const fx = metrics?.days.at(-1);

  const resolve = async (item: AttentionItem) => {
    try {
      await api('adminResolveAlert', { params: { id: item.id.replace(/^alert:/, '') } });
      setActionError(null);
      await reload();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  return (
    <>
      <PageHeader
        title="Hoy"
        text={`Últimos ${String(days)} días contra los ${String(days)} anteriores`}
        actions={
          <div className="flex gap-1" role="group" aria-label="Período">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                onClick={() => {
                  setDays(range);
                }}
                className="h-8 rounded-md border px-3 text-sm aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:font-semibold"
              >
                {range} días
              </button>
            ))}
          </div>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <div className="grid gap-6">
        <AttentionCard
          items={attention?.items ?? null}
          onResolve={(item) => {
            void resolve(item);
          }}
        />
        {metrics && <KpiRow totals={metrics.totals} previous={metrics.previous} />}
        {totals && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ContributionWaterfall totals={totals} />
            <FunnelByLine totals={totals} />
          </div>
        )}
        {totals && <ProductTable totals={totals} />}
        {totals && <StyleTable totals={totals} />}

        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Contribución por día (USD)</h2>
            <button
              type="button"
              className="text-sm text-primary underline"
              onClick={() => {
                setTable(!table);
              }}
            >
              {table ? 'Ver gráfico' : 'Ver tabla'}
            </button>
          </div>
          {metrics &&
            (table ? (
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1">Día</th>
                      <th>Pedidos</th>
                      <th>Ventas</th>
                      <th>Muestras</th>
                      <th>IA</th>
                      <th>Comisión</th>
                      <th>Contribución</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...metrics.days].reverse().map((day) => (
                      <tr key={day.day} className="border-t">
                        <td className="py-1">
                          {day.day}
                          {day.final ? '' : ' (en curso)'}
                        </td>
                        <td>{day.orders}</td>
                        <td>{usd(day.revenueUsd)}</td>
                        <td>{day.previews}</td>
                        <td>{usd(day.aiCostUsd)}</td>
                        <td>{usd(day.paymentFeeUsd)}</td>
                        <td>{usd(day.contributionUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <DailyBars
                label={`Contribución por día de los últimos ${String(days)} días`}
                points={metrics.days.map((day) => ({
                  day: day.day,
                  value: day.contributionUsd,
                  partial: !day.final,
                  detail: `${String(day.orders)} pedidos · ventas ${usd(day.revenueUsd)} · ${String(day.previews)} muestras`,
                }))}
              />
            ))}
          <p className="mt-2 text-xs text-muted-foreground">
            Montos convertidos a USD con la cotización del día (
            {fx ? `${fx.fxSource}, ${fx.fxDate}` : '…'}). Los últimos 35 días se recalculan en cada
            visita, porque un reembolso o un cambio de estado cambia sus números.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 font-semibold">Ventas por país (USD)</h2>
            {Object.keys(totals?.revenueUsdByCountry ?? {}).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
            ) : (
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {Object.entries(totals?.revenueUsdByCountry ?? {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([country, value]) => (
                      <tr key={country} className="border-t first:border-0">
                        <td className="py-1">{country}</td>
                        <td className="text-right">{usd(value)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Estado</h2>
            <p className="text-sm">
              Sitio: <strong>{site ? SITE_MODE_INFO[site.mode].label : '…'}</strong>{' '}
              <Link href="/site" className="text-primary underline">
                cambiar
              </Link>
            </p>
            <p className="mt-1 text-sm">
              IA hoy: <strong>{ai ? usd(ai.spentTodayUsd) : '…'}</strong>
              {ai && ` de ${usd(ai.config.dailyBudgetUsd)} de presupuesto`}{' '}
              <Link href="/ai" className="text-primary underline">
                ver
              </Link>
            </p>
          </Card>
        </div>

        {totals && <LoginCard logins={totals.logins} />}
      </div>
    </>
  );
}

/** Login por tipo de navegador y método (apps como Instagram vs. navegadores comunes). */
function LoginCard({ logins }: { logins: Record<string, number> }) {
  const rows = (['embedded', 'standard'] as const).flatMap((browser) =>
    (['google', 'apple', 'email'] as const).map((method) => {
      const sum = (stage: string) =>
        Object.entries(logins)
          .filter(([key]) => key.startsWith(`${browser}_${method}_`) && key.endsWith(`_${stage}`))
          .reduce((total, [, value]) => total + value, 0);
      return { browser, method, started: sum('started'), succeeded: sum('succeeded') };
    }),
  );
  const used = rows.filter((row) => row.started > 0 || row.succeeded > 0);
  return (
    <Card>
      <h2 className="font-semibold">Login por navegador</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Contadores del servidor (en el login no corre Google Analytics). &quot;En apps&quot; son los
        navegadores de Instagram, Facebook, WhatsApp y TikTok.
      </p>
      {used.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin logins en el período.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1">Navegador</th>
              <th>Método</th>
              <th>Empezaron</th>
              <th>Entraron</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {used.map((row) => (
              <tr key={`${row.browser}-${row.method}`} className="border-t">
                <td className="py-1">{row.browser === 'embedded' ? 'En apps' : 'Común'}</td>
                <td>{row.method === 'email' ? 'Enlace por mail' : row.method}</td>
                <td>{row.started}</td>
                <td>{row.succeeded}</td>
                <td>
                  {row.started > 0
                    ? `${String(Math.round((row.succeeded / row.started) * 100))} %`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
