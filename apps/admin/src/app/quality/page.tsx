'use client';

import { useCallback, useState } from 'react';

import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const RANGES = [7, 30, 90] as const;
const usd = (value: number) => `USD ${value.toFixed(2)}`;
const entries = (record: Record<string, number>) =>
  Object.entries(record).sort((a, b) => b[1] - a[1]);

/** Calidad, imprenta y canales: solo códigos y totales, ningún dato del niño. */
export default function QualityPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const load = useCallback(() => api('adminInsights', { query: { days } }), [days]);
  const { data, error } = useApi(load);
  return (
    <>
      <PageHeader
        title="Calidad y canales"
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
      {data && (
        <div className="grid gap-4">
          <Card>
            <h2 className="mb-2 font-semibold">Calidad</h2>
            <table className="w-full text-sm">
              <tbody>
                {data.quality.map((item) => (
                  <tr key={item.metric} className="border-t align-top first:border-0">
                    <td className="py-1 font-mono text-xs">{item.metric}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">
                      {item.value === null
                        ? '—'
                        : item.metric === 'character_regenerations_per_book'
                          ? item.value
                          : `${String(item.value)} %`}
                    </td>
                    <td className="py-1 pl-3 text-xs text-muted-foreground tabular-nums">
                      {item.numerator} / {item.denominator}
                    </td>
                    <td className="py-1 pl-3 text-xs text-muted-foreground">{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-2 font-semibold">Ventas por canal</h2>
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th>Canal</th>
                    <th>Pedidos</th>
                    <th>Ingresos</th>
                    <th>Ticket</th>
                    <th>Repiten</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.map((channel) => (
                    <tr key={channel.channel} className="border-t">
                      <td className="py-1">{channel.channel}</td>
                      <td>{channel.orders}</td>
                      <td>{usd(channel.revenueUsd)}</td>
                      <td>{usd(channel.avgTicketUsd)}</td>
                      <td>{channel.repeatCustomers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h2 className="mb-2 font-semibold">Lo más elegido</h2>
              {(['formats', 'lengths', 'densities'] as const).map((key) => (
                <p key={key} className="text-sm">
                  <span className="text-muted-foreground">
                    {key === 'formats'
                      ? 'Formatos'
                      : key === 'lengths'
                        ? 'Extensiones'
                        : 'Densidades'}
                    :
                  </span>{' '}
                  {entries(data.choices[key])
                    .map(([name, count]) => `${name} (${String(count)})`)
                    .join(', ') || '—'}
                </p>
              ))}
            </Card>
          </div>
          <Card>
            <h2 className="mb-2 font-semibold">Imprenta por proveedor, formato y país</h2>
            {data.print.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos impresos en el período.</p>
            ) : (
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th>Imprenta</th>
                    <th>Formato</th>
                    <th>País</th>
                    <th>Pedidos</th>
                    <th>Fallas</th>
                    <th>Cancelados</th>
                    <th>Tasa de falla</th>
                  </tr>
                </thead>
                <tbody>
                  {data.print.map((row) => (
                    <tr key={`${row.provider}-${row.format}-${row.country}`} className="border-t">
                      <td className="py-1">{row.provider}</td>
                      <td>{row.format}</td>
                      <td>{row.country}</td>
                      <td>{row.orders}</td>
                      <td>{row.failed}</td>
                      <td>{row.cancelled}</td>
                      <td>{row.failureRate} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Códigos de QA</h2>
            <p className="text-sm">
              {entries(data.qaCodes)
                .map(([code, count]) => `${code}: ${String(count)}`)
                .join(' · ') || 'Sin eventos en el período.'}
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
