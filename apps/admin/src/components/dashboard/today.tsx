'use client';

import type { AttentionItem } from '@storynido/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/page-header';
import type { api } from '@/lib/api';

type Metrics = Awaited<ReturnType<typeof api<'adminMetrics'>>>;
type Totals = Metrics['totals'];
type Previous = Metrics['previous'];

/** Contribución mínima por venta que buscamos (decisión de precios, 7 nov 2026). */
export const FLOOR_USD = 8;

export const usd = (value: number) =>
  value.toLocaleString('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const LENGTHS: Record<string, string> = {
  mini: 'Mini (12 págs.)',
  short: 'Corto (16)',
  classic: 'Clásico (28)',
  epic: 'Gran aventura (32)',
};
const FORMATS: Record<string, string> = {
  digital: 'digital',
  softcover: 'tapa blanda',
  hardcover: 'tapa dura',
  booklet: 'grapado',
};
const CONTENT: Record<string, string> = {
  story_activities: 'Cuento + actividades',
  activities: 'Solo actividades',
  coloring: 'Para colorear',
};
const EVENTS: Record<string, string> = {
  event_kit: 'Kit completo',
  event_kit_partial: 'Kit con algunas piezas',
  event_invitation: 'Invitación',
  event_extra: 'Piezas extra',
  event_cards: 'Tarjetas impresas',
};

/** Nombre legible de la clave de producto (`metricsProductKey`). */
export function productLabel(key: string): { name: string; line: string } {
  if (key in EVENTS) return { name: EVENTS[key] ?? key, line: 'Celebraciones' };
  if (key === 'other') return { name: 'Otro', line: '—' };
  const pro = key.startsWith('pro_');
  let rest = pro ? key.slice(4) : key;
  let content = '';
  for (const [code, label] of Object.entries(CONTENT)) {
    if (rest.startsWith(`${code}_`)) {
      content = label;
      rest = rest.slice(code.length + 1);
      break;
    }
  }
  const [length = '', format = ''] = rest.split('_');
  const base = LENGTHS[length] ?? length;
  const name = `${content ? `${content}, ` : ''}${base}${format && format !== 'digital' ? `, ${FORMATS[format] ?? format}` : ''}`;
  return { name, line: pro ? 'Profesionales' : 'Familias' };
}

const LINE_STYLE: Record<string, string> = {
  Familias: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  Celebraciones: 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  Profesionales: 'bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
};

function ago(since: string | null): string {
  if (!since) return '';
  const hours = (Date.now() - Date.parse(since)) / 3_600_000;
  if (hours < 1) return 'hace menos de 1 h';
  if (hours < 48) return `hace ${String(Math.round(hours))} h`;
  return `hace ${String(Math.round(hours / 24))} días`;
}

const LEVELS: Record<AttentionItem['level'], { label: string; className: string }> = {
  urgent: {
    label: 'Urgente',
    className: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  },
  review: {
    label: 'Revisar',
    className: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  notice: { label: 'Aviso', className: 'bg-accent text-foreground' },
};

/** Bloque 1: lo que espera una acción. Vacío, una línea. */
export function AttentionCard({
  items,
  onResolve,
}: {
  items: AttentionItem[] | null;
  onResolve: (item: AttentionItem) => void;
}) {
  if (!items) return null;
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm">
          <strong>Todo en orden.</strong> No hay avisos, pedidos trabados ni cotizaciones sin
          responder.
        </p>
      </Card>
    );
  }
  const oldest = items
    .map((item) => item.since)
    .filter((since): since is string => Boolean(since))
    .sort()[0];
  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold">Necesita tu atención</h2>
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'cosa' : 'cosas'}
          {oldest ? ` · la más vieja espera ${ago(oldest)}` : ''}
        </p>
      </div>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => {
          const level = LEVELS[item.level];
          return (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-3 rounded-md px-3 py-2 ${level.className}`}
            >
              <span className="w-16 text-xs font-semibold uppercase">{level.label}</span>
              <span className="min-w-60 flex-1 text-sm font-medium">
                {item.title}
                {item.orderId ? ` · pedido ${item.orderId}` : ''}
              </span>
              <span className="text-xs">{ago(item.since)}</span>
              <Link href={item.href} className="text-sm font-semibold underline">
                Abrir
              </Link>
              {item.resolvable && (
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => {
                    onResolve(item);
                  }}
                >
                  Marcar resuelto
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Trend({
  now,
  before,
  points = false,
}: {
  now: number;
  before: number | undefined;
  points?: boolean;
}) {
  if (before === undefined) return null;
  if (points) {
    const diff = Math.round((now - before) * 10) / 10;
    if (diff === 0) return <p className="mt-1 text-xs text-muted-foreground">Igual que antes</p>;
    return (
      <p className={`mt-1 text-xs font-semibold ${diff > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
        {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString('es')} puntos
      </p>
    );
  }
  if (before === 0)
    return <p className="mt-1 text-xs text-muted-foreground">Sin período anterior</p>;
  const change = Math.round(((now - before) / Math.abs(before)) * 100);
  return (
    <p
      className={`mt-1 text-xs font-semibold ${change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
    >
      {change >= 0 ? '▲' : '▼'} {Math.abs(change)} % contra el período anterior
    </p>
  );
}

function Kpi({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint: string;
  trend: ReactNode;
}) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {trend}
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

/** Bloque 2: los cuatro números, contra el período anterior. */
export function KpiRow({ totals, previous }: { totals: Totals; previous: Previous }) {
  const perSale = totals.orders ? totals.contributionUsd / totals.orders : 0;
  const previousPerSale = previous?.orders ? previous.contributionUsd / previous.orders : undefined;
  const byChannel = (['families', 'events', 'professionals'] as const)
    .map((channel) => totals.funnelByChannel[channel]?.purchased ?? 0)
    .join(' · ');
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        label="Contribución"
        value={usd(totals.contributionUsd)}
        trend={<Trend now={totals.contributionUsd} before={previous?.contributionUsd} />}
        hint="Lo que queda después de impuestos, comisión de pago, IA e impresión"
      />
      <Kpi
        label="Pedidos"
        value={String(totals.orders)}
        trend={<Trend now={totals.orders} before={previous?.orders} />}
        hint={`Familias · Celebraciones · Profesionales: ${byChannel}`}
      />
      <Kpi
        label="Conversión muestra → compra"
        value={`${totals.conversionPct.toLocaleString('es')} %`}
        trend={<Trend now={totals.conversionPct} before={previous?.conversionPct} points />}
        hint={`${String(totals.orders)} pedidos ÷ ${String(totals.previews)} muestras del período`}
      />
      <Kpi
        label="Contribución por venta"
        value={usd(perSale)}
        trend={<Trend now={perSale} before={previousPerSale} />}
        hint={`Piso buscado: ${usd(FLOOR_USD)}`}
      />
    </div>
  );
}

/** Bloque 3: de las ventas a la contribución. */
export function ContributionWaterfall({ totals }: { totals: Totals }) {
  const total = totals.revenueUsd;
  const steps = [
    { label: 'Impuestos (IVA)', value: totals.taxUsd },
    { label: 'Comisión de pago (estimada)', value: totals.paymentFeeUsd },
    { label: 'IA de libros vendidos', value: totals.aiBooksUsd },
    { label: 'IA de muestras y personajes', value: totals.aiPreviewsUsd },
    { label: 'Impresión y envío', value: totals.printCostUsd },
  ];
  let level = total;
  const kept = total > 0 ? Math.round((totals.contributionUsd / total) * 100) : 0;
  const width = (value: number) => (total > 0 ? Math.max(0, (value / total) * 100) : 0);
  return (
    <Card>
      <h2 className="font-semibold">
        {total > 0
          ? `De cada US$ 100 vendidos quedan US$ ${String(kept)}`
          : 'De la venta a la contribución'}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Lo que se resta de las ventas hasta la contribución, en USD.
      </p>
      <div className="mt-4 grid gap-2 text-sm">
        <Row label="Ventas" value={usd(total)} left={0} width={100} tone="bg-foreground" strong />
        {steps.map((step) => {
          level -= step.value;
          return (
            <Row
              key={step.label}
              label={step.label}
              value={`− ${usd(step.value)}`}
              left={width(level)}
              width={width(step.value)}
              tone="bg-orange-300"
            />
          );
        })}
        <Row
          label="Contribución"
          value={usd(totals.contributionUsd)}
          left={0}
          width={width(totals.contributionUsd)}
          tone="bg-emerald-500"
          strong
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        La comisión se estima por proveedor (PayPal 5,4 % + 0,30; Dodo 5,5 % + 0,40; Gumroad 12,9 %
        + 0,80) e incluye la de los reembolsos, que no se devuelve. Reembolsado en el período:{' '}
        {usd(totals.refundedUsd)} ({totals.refunds}), ya fuera de las ventas.
      </p>
    </Card>
  );
}

function Row({
  label,
  value,
  left,
  width,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  left: number;
  width: number;
  tone: string;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_6rem] items-center gap-2">
      <span className={strong ? 'font-semibold' : ''}>{label}</span>
      <div className="relative h-5 rounded bg-muted">
        <div
          className={`absolute inset-y-0 rounded ${tone}`}
          style={{ left: `${String(left)}%`, width: `${String(width)}%` }}
        />
      </div>
      <span className={`text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

const STEP_LABELS = [
  ['started', 'Empezaron'],
  ['character', 'Personaje'],
  ['preview', 'Muestra'],
  ['checkout', 'Pago iniciado'],
  ['purchased', 'Compraron'],
] as const;

const CHANNEL_NAMES = {
  families: 'Familias',
  events: 'Celebraciones',
  professionals: 'Profesionales',
} as const;

/** Bloque 5: embudo por línea, con el paso donde más se cae. */
export function FunnelByLine({ totals }: { totals: Totals }) {
  return (
    <Card>
      <h2 className="font-semibold">Embudo por línea</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Contado en el servidor por día de creación del libro, sin datos del niño. En naranja, el
        paso donde más gente se pierde.
      </p>
      <div className="mt-4 grid gap-5">
        {(Object.keys(CHANNEL_NAMES) as (keyof typeof CHANNEL_NAMES)[]).map((channel) => {
          const funnel = totals.funnelByChannel[channel];
          const counts = STEP_LABELS.map(([step]) => funnel?.[step] ?? 0);
          const first = counts[0] ?? 0;
          // El paso con la peor retención respecto del anterior.
          let worst = -1;
          let worstRate = 1;
          counts.forEach((count, index) => {
            const before = index > 0 ? (counts[index - 1] ?? 0) : 0;
            if (index > 0 && before > 0 && count / before < worstRate) {
              worstRate = count / before;
              worst = index;
            }
          });
          return (
            <div key={channel}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{CHANNEL_NAMES[channel]}</span>
                <span className="text-xs text-muted-foreground">
                  {worst > 0
                    ? `pasa el ${String(Math.round(worstRate * 100))} % de ${STEP_LABELS[worst - 1]?.[1] ?? ''} a ${STEP_LABELS[worst]?.[1] ?? ''}`
                    : 'sin datos en el período'}
                </span>
              </div>
              <ol className="grid grid-cols-5 gap-1">
                {STEP_LABELS.map(([step, label], index) => {
                  const count = counts[index] ?? 0;
                  return (
                    <li key={step} className="flex flex-col gap-0.5">
                      <div className="flex h-10 items-end rounded bg-muted">
                        <div
                          className={`w-full rounded ${index === worst ? 'bg-orange-400' : 'bg-primary/70'}`}
                          style={{
                            height: `${String(first ? Math.max(4, (count / first) * 100) : 0)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{count}</span>
                      <span className="text-xs leading-tight text-muted-foreground">{label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Bloque 4: por producto, con alerta bajo el piso. */
export function ProductTable({ totals }: { totals: Totals }) {
  const rows = Object.entries(totals.products)
    .map(([key, value]) => {
      const contribution =
        value.revenueUsd - value.taxUsd - value.feeUsd - value.aiUsd - value.printUsd;
      return {
        key,
        ...productLabel(key),
        ...value,
        perUnit: value.units ? contribution / value.units : 0,
        price: value.units ? value.revenueUsd / value.units : 0,
      };
    })
    .sort((a, b) => b.revenueUsd - a.revenueUsd);
  const low = rows.filter((row) => row.perUnit < FLOOR_USD);
  return (
    <Card>
      <h2 className="font-semibold">
        {low.length
          ? `Por producto: ${String(low.length)} ${low.length === 1 ? 'queda' : 'quedan'} bajo el piso de ${usd(FLOOR_USD)}`
          : 'Por producto'}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Contribución por unidad = precio − impuestos − comisión − IA del libro − impresión. No
        incluye la IA de muestras que no se compraron ni la de páginas rehechas después de la
        generación (columna Rehechos, que sí está en el total de IA). Los pagos simulados no
        cuentan.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin ventas en el período.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Producto</th>
                <th>Línea</th>
                <th className="text-right">Unidades</th>
                <th className="text-right">Precio medio</th>
                <th className="text-right">Comisión</th>
                <th className="text-right">IA</th>
                <th className="text-right" title="Páginas rehechas después de la generación">
                  Rehechos
                </th>
                <th className="text-right">Por unidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="py-2 font-medium">{row.name}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LINE_STYLE[row.line] ?? ''}`}
                    >
                      {row.line}
                    </span>
                  </td>
                  <td className="text-right">{row.units}</td>
                  <td className="text-right">{usd(row.price)}</td>
                  <td className="text-right">{usd(row.units ? row.feeUsd / row.units : 0)}</td>
                  <td className="text-right">{usd(row.units ? row.aiUsd / row.units : 0)}</td>
                  <td className="text-right text-muted-foreground">
                    {row.aiRedoUsd ? usd(row.aiRedoUsd / row.units) : '—'}
                  </td>
                  <td
                    className={`text-right font-semibold ${row.perUnit < FLOOR_USD ? 'text-red-700' : ''}`}
                  >
                    {usd(row.perUnit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const STYLE_NAMES: Record<string, string> = {
  'gouache-editorial': 'Gouache editorial',
  'collage-papel': 'Collage de papel',
  'minimalismo-grafico': 'Minimalismo gráfico',
  'cuento-clasico': 'Cuento clásico',
  'novela-grafica': 'Novela gráfica',
  cuaderno: 'Cuaderno',
  manga: 'Manga',
  'lapices-de-colores': 'Lápices de colores',
  acuarela: 'Acuarela',
  'cartoon-3d': 'Cartoon 3D',
  'para-colorear': 'Para colorear',
  'sin-estilo': 'Sin estilo',
};

const pct = (part: number, whole: number) =>
  whole ? `${String(Math.round((part / whole) * 100))} %` : '—';

/** Bloque 5: qué estilo eligen y cuál compran (DECISIONS 268). */
export function StyleTable({ totals }: { totals: Totals }) {
  const rows = Object.entries(totals.styles)
    .map(([key, value]) => ({ key, name: STYLE_NAMES[key] ?? key, ...value }))
    .sort((a, b) => b.chosen - a.chosen || b.purchased - a.purchased);
  const chosen = rows.reduce((sum, row) => sum + row.chosen, 0);
  return (
    <Card>
      <h2 className="font-semibold">Por estilo de ilustración</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Elegido = libros que llegaron a la lámina del personaje con ese estilo. Compra = pedidos
        pagados de libros con ese estilo. Cuenta desde el 18 nov 2026.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin muestras en el período.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm tabular-nums">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Estilo</th>
                <th className="text-right">Elegido</th>
                <th className="text-right">% del total</th>
                <th className="text-right">Muestras</th>
                <th className="text-right">Compras</th>
                <th className="text-right">Compra / elegido</th>
                <th className="text-right">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="py-2 font-medium">{row.name}</td>
                  <td className="text-right">{row.chosen}</td>
                  <td className="text-right">{pct(row.chosen, chosen)}</td>
                  <td className="text-right">{row.previews}</td>
                  <td className="text-right">{row.purchased}</td>
                  <td className="text-right">{pct(row.purchased, row.chosen)}</td>
                  <td className="text-right">{usd(row.revenueUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
