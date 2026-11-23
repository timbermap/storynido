'use client';

import { useCallback, useState } from 'react';

import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const RANGES = [7, 30, 90] as const;
const nf = new Intl.NumberFormat('es');
const usd = new Intl.NumberFormat('es', { style: 'currency', currency: 'USD' });

const EVENT_LABELS: Record<string, string> = {
  create_started: 'Empezaron un cuento',
  preview_created: 'Vista previa creada',
  begin_checkout: 'Pago iniciado',
  purchase: 'Compra',
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Table({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <Card>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía sin datos.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              {head.map((label, index) => (
                <th key={label} className={`pb-1 font-normal ${index ? 'text-right' : ''}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])} className="border-t">
                {row.map((cell, index) => (
                  <td
                    key={index}
                    className={`py-1 ${index ? 'text-right tabular-nums' : 'max-w-[18rem] truncate'}`}
                  >
                    {typeof cell === 'number' ? nf.format(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const load = useCallback(() => api('adminAnalytics', { query: { days } }), [days]);
  const { data, error } = useApi(load);
  const max = Math.max(1, ...(data?.daily.map((row) => row.users) ?? [0]));

  return (
    <>
      <PageHeader
        title="Google Analytics"
        text="Lo que mide Google Analytics 4, solo de quienes aceptaron las cookies de analítica (por eso da menos que «Visitas y campañas», que cuenta a todos sin cookies). Solo lectura; se actualiza cada 10 minutos."
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
      {data && !data.connected && <Notice tone="error">{data.message}</Notice>}
      {data?.connected && (
        <div className="grid gap-4">
          <Card>
            <div className="grid gap-4 sm:grid-cols-5">
              <Kpi label="Usuarios" value={nf.format(data.totals.users)} />
              <Kpi label="Sesiones" value={nf.format(data.totals.sessions)} />
              <Kpi label="Vistas de página" value={nf.format(data.totals.views)} />
              <Kpi label="Compras" value={nf.format(data.totals.purchases)} />
              <Kpi label="Ingresos" value={usd.format(data.totals.revenue)} />
            </div>
            <div className="mt-4">
              <p className="mb-1 text-xs text-muted-foreground">Usuarios por día</p>
              <div className="flex h-16 items-end gap-px" role="img" aria-label="Usuarios por día">
                {data.daily.map((row) => (
                  <div
                    key={row.day}
                    className="bg-chart-1 flex-1 rounded-t-sm"
                    title={`${row.day}: ${nf.format(row.users)}`}
                    style={{ height: `${String((row.users / max) * 100)}%`, minHeight: 2 }}
                  />
                ))}
              </div>
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Table
              title="Pasos del embudo"
              head={['Paso', 'Eventos']}
              rows={data.events.map((row) => [EVENT_LABELS[row.key] ?? row.key, row.count])}
            />
            <Table
              title="De dónde llegan"
              head={['Fuente / medio', 'Sesiones', 'Usuarios', 'Compras']}
              rows={data.sources.map((row) => [row.key, row.sessions, row.users, row.purchases])}
            />
            <Table
              title="Países"
              head={['País', 'Usuarios']}
              rows={data.countries.map((row) => [row.key, row.users])}
            />
            <Table
              title="Páginas más vistas"
              head={['Página', 'Vistas']}
              rows={data.pages.map((row) => [row.key, row.views])}
            />
          </div>
        </div>
      )}
      {!data && !error && <p className="text-sm text-muted-foreground">Cargando…</p>}
    </>
  );
}
