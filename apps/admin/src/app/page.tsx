'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { DailyBars } from '@/components/dashboard/daily-bars';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { SITE_MODE_INFO } from '@/lib/site-modes';
import { useApi } from '@/lib/use-api';

const RANGES = [7, 30, 90] as const;

const FUNNEL = [
  { step: 'started', label: 'Empezaron el creador' },
  { step: 'character', label: 'Vieron su personaje' },
  { step: 'approved', label: 'Aprobaron el personaje' },
  { step: 'preview', label: 'Vieron la muestra' },
  { step: 'checkout', label: 'Iniciaron el pago' },
  { step: 'purchased', label: 'Compraron' },
] as const;

const usd = (value: number) =>
  value.toLocaleString('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/**
 * Resumen: ventas, ingresos por país (en USD), ticket promedio, conversión de muestra a compra,
 * costos de IA e impresión y margen estimado. Los días cerrados vienen precalculados.
 */
export default function SummaryPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [table, setTable] = useState(false);
  const load = useCallback(
    () =>
      Promise.all([
        api('adminSiteConfig'),
        api('adminAiConfig'),
        api('adminMetrics', { query: { days } }),
      ]),
    [days],
  );
  const { data, error } = useApi(load);
  const [site, ai, metrics] = data ?? [];
  const totals = metrics?.totals;
  const today = metrics?.days.at(-1);
  const week = metrics?.days.slice(-7) ?? [];
  const weekRevenue = week.reduce((sum, day) => sum + day.revenueUsd, 0);
  const countries = Object.entries(totals?.revenueUsdByCountry ?? {}).sort((a, b) => b[1] - a[1]);
  const fx = today ? `${today.fxSource}, ${today.fxDate}` : '';

  return (
    <>
      <PageHeader
        title="Resumen"
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Ventas de hoy"
          value={today ? usd(today.revenueUsd) : '…'}
          hint={today ? `${String(today.orders)} pedidos` : undefined}
        />
        <Stat label="Últimos 7 días" value={metrics ? usd(weekRevenue) : '…'} />
        <Stat
          label={`Últimos ${String(days)} días`}
          value={totals ? usd(totals.revenueUsd) : '…'}
          hint={
            totals
              ? `${String(totals.orders)} pedidos · ${String(totals.refunds)} reembolsos`
              : undefined
          }
        />
        <Stat label="Ticket promedio" value={totals ? usd(totals.avgTicketUsd) : '…'} />
        <Stat
          label="Conversión muestra → compra"
          value={totals ? `${String(totals.conversionPct)} %` : '…'}
          hint={
            totals
              ? `${String(totals.orders)} pedidos ÷ ${String(totals.previews)} muestras del período`
              : undefined
          }
        />
        <Stat
          label="Costo de IA"
          value={totals ? usd(totals.aiCostUsd) : '…'}
          hint="Incluye muestras no compradas"
        />
        <Stat label="Impresión y envío" value={totals ? usd(totals.printCostUsd) : '…'} />
        <Stat
          label="Margen neto estimado"
          value={totals ? usd(totals.marginUsd) : '…'}
          hint="Sin impuestos, IA ni impresión; sin comisiones de pago"
        />
      </div>

      {totals && (
        <Card className="mt-6">
          <h2 className="font-semibold">Embudo del período</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Contado en el servidor, por día (no por cohorte), sin datos del niño.
            {totals.daysWithoutFunnel > 0 &&
              ` ${String(totals.daysWithoutFunnel)} días del rango son anteriores al embudo y no suman.`}
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {FUNNEL.map(({ step, label }, index) => {
              const value = totals.funnel[step] ?? 0;
              const previous =
                index > 0 ? (totals.funnel[FUNNEL[index - 1]?.step ?? step] ?? 0) : 0;
              return (
                <li key={step} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
                  {index > 0 && previous > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Math.round((value / previous) * 100)} % del paso anterior
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {totals && <LoginCard logins={totals.logins} />}

      <Card className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Ingresos por día (USD)</h2>
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
                    <th>Ingresos</th>
                    <th>Muestras</th>
                    <th>IA</th>
                    <th>Margen</th>
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
                      <td>{usd(day.marginUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <DailyBars
              label={`Ingresos por día de los últimos ${String(days)} días`}
              points={metrics.days.map((day) => ({
                day: day.day,
                value: day.revenueUsd,
                partial: !day.final,
                detail: `${String(day.orders)} pedidos · ${String(day.previews)} muestras · margen ${usd(day.marginUsd)}`,
              }))}
            />
          ))}
        <p className="mt-2 text-xs text-muted-foreground">
          Montos convertidos a USD con la cotización del día ({fx || '…'}). Los días cerrados quedan
          guardados; hoy se recalcula en cada visita.
        </p>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Ingresos por país (USD)</h2>
          {countries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <tbody>
                {countries.map(([country, value]) => (
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
    <Card className="mt-6">
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
