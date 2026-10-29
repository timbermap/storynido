import { CURRENCY_MINOR_UNITS, type Currency } from '../currency';
import type { OrderStatus } from '../order-status';

/** Pedidos que cuentan como venta: pagados y no reembolsados ni cancelados. */
export const REVENUE_ORDER_STATUSES: readonly OrderStatus[] = [
  'paid',
  'generating',
  'ready',
  'qa_failed',
  'sent_to_print',
  'in_production',
  'shipped',
  'delivered',
];

/** fxRates/{día}: unidades de cada moneda por 1 USD (fuente: open.er-api.com, ExchangeRate-API). */
export interface FxRates {
  rates: Partial<Record<Currency, number>>;
  source: string;
  /** Día de la cotización (puede ser anterior si ese día no se pudo consultar). */
  date: string;
}

export interface MetricsOrder {
  status: OrderStatus;
  channel: string;
  country: string;
  currency: Currency;
  amounts: { totalMinor: number; taxMinor: number };
  /** Costo de impresión y envío que cotizó la imprenta elegida (USD, centavos). */
  printCostUsdMinor: number | null;
}

/**
 * Embudo del día, contado en el servidor con datos propios (en el creador no hay analítica de
 * terceros: hay datos y fotos del niño). Por día, no por cohorte: lo que pasó ese día.
 */
export const FUNNEL_STEPS = [
  'started',
  'character',
  'preview',
  'approved',
  'checkout',
  'purchased',
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export type Funnel = Record<FunnelStep, number>;

export interface FunnelBook {
  /** Lámina del personaje generada. */
  character: boolean;
  /** Muestra completa (portada y páginas). */
  preview: boolean;
  /** Personaje aprobado por el adulto. */
  approved: boolean;
}

/** metricsDaily/{AAAA-MM-DD}: agregados del día (los días cerrados no se recalculan). */
export interface DayMetrics {
  day: string;
  /** El día de hoy se calcula en vivo (todavía puede cambiar). */
  final: boolean;
  orders: number;
  refunds: number;
  revenueUsd: number;
  /** Sin impuestos: lo que queda para cubrir costos y margen. */
  netRevenueUsd: number;
  revenueByCurrency: Partial<Record<Currency, number>>;
  revenueUsdByCountry: Record<string, number>;
  ordersByChannel: Record<string, number>;
  avgTicketUsd: number;
  /** Muestras creadas ese día (libros distintos con IA de vista previa). */
  previews: number;
  /** Pedidos ÷ muestras del mismo día, en %. */
  conversionPct: number;
  /** Todo el gasto de IA del día (muestras que no se compraron incluidas). */
  aiCostUsd: number;
  printCostUsd: number;
  /** Ingresos sin impuestos − IA − impresión y envío (sin comisiones de pago: proveedor por definir). */
  marginUsd: number;
  fxSource: string;
  fxDate: string;
  /** Ausente en días calculados antes del embudo. */
  funnel?: Funnel;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Monto en USD: unidad mínima → unidad → USD con la cotización del día. */
export function toUsd(amountMinor: number, currency: Currency, fx: FxRates): number {
  const rate = currency === 'USD' ? 1 : fx.rates[currency];
  if (!rate) return 0;
  return amountMinor / 10 ** CURRENCY_MINOR_UNITS[currency] / rate;
}

export function aggregateDay(input: {
  day: string;
  final: boolean;
  orders: readonly MetricsOrder[];
  previews: number;
  aiCostUsdMicros: number;
  fx: FxRates;
  /** Libros creados ese día. */
  books?: readonly FunnelBook[];
}): DayMetrics {
  const sold = input.orders.filter((order) => REVENUE_ORDER_STATUSES.includes(order.status));
  const revenueByCurrency: Partial<Record<Currency, number>> = {};
  const revenueUsdByCountry: Record<string, number> = {};
  const ordersByChannel: Record<string, number> = {};
  let revenueUsd = 0;
  let taxUsd = 0;
  let printUsd = 0;
  for (const order of sold) {
    const total = toUsd(order.amounts.totalMinor, order.currency, input.fx);
    revenueUsd += total;
    taxUsd += toUsd(order.amounts.taxMinor, order.currency, input.fx);
    printUsd += (order.printCostUsdMinor ?? 0) / 100;
    revenueByCurrency[order.currency] =
      (revenueByCurrency[order.currency] ?? 0) + order.amounts.totalMinor;
    revenueUsdByCountry[order.country] = round((revenueUsdByCountry[order.country] ?? 0) + total);
    ordersByChannel[order.channel] = (ordersByChannel[order.channel] ?? 0) + 1;
  }
  const aiCostUsd = input.aiCostUsdMicros / 1_000_000;
  const netRevenueUsd = revenueUsd - taxUsd;
  return {
    day: input.day,
    final: input.final,
    orders: sold.length,
    refunds: input.orders.filter((order) => order.status === 'refunded').length,
    revenueUsd: round(revenueUsd),
    netRevenueUsd: round(netRevenueUsd),
    revenueByCurrency,
    revenueUsdByCountry,
    ordersByChannel,
    avgTicketUsd: sold.length ? round(revenueUsd / sold.length) : 0,
    previews: input.previews,
    conversionPct: input.previews ? round((sold.length / input.previews) * 100) : 0,
    aiCostUsd: round(aiCostUsd),
    printCostUsd: round(printUsd),
    marginUsd: round(netRevenueUsd - aiCostUsd - printUsd),
    fxSource: input.fx.source,
    fxDate: input.fx.date,
    ...(input.books
      ? {
          funnel: {
            started: input.books.length,
            character: input.books.filter((book) => book.character).length,
            preview: input.books.filter((book) => book.preview).length,
            approved: input.books.filter((book) => book.approved).length,
            // Pedidos creados ese día (cualquier estado) y los que se pagaron.
            checkout: input.orders.length,
            purchased: sold.length,
          },
        }
      : {}),
  };
}

/** Totales de un rango (los promedios se recalculan sobre la suma, no se promedian promedios). */
export function sumMetrics(days: readonly DayMetrics[]) {
  const total = (key: 'orders' | 'refunds' | 'previews') =>
    days.reduce((sum, day) => sum + day[key], 0);
  const money = (
    key: 'revenueUsd' | 'netRevenueUsd' | 'aiCostUsd' | 'printCostUsd' | 'marginUsd',
  ) => round(days.reduce((sum, day) => sum + day[key], 0));
  const orders = total('orders');
  const previews = total('previews');
  const revenueUsdByCountry: Record<string, number> = {};
  for (const day of days) {
    for (const [country, value] of Object.entries(day.revenueUsdByCountry)) {
      revenueUsdByCountry[country] = round((revenueUsdByCountry[country] ?? 0) + value);
    }
  }
  return {
    orders,
    refunds: total('refunds'),
    previews,
    revenueUsd: money('revenueUsd'),
    netRevenueUsd: money('netRevenueUsd'),
    aiCostUsd: money('aiCostUsd'),
    printCostUsd: money('printCostUsd'),
    marginUsd: money('marginUsd'),
    avgTicketUsd: orders ? round(money('revenueUsd') / orders) : 0,
    conversionPct: previews ? round((orders / previews) * 100) : 0,
    revenueUsdByCountry,
    funnel: Object.fromEntries(
      FUNNEL_STEPS.map((step) => [
        step,
        days.reduce((sum, day) => sum + (day.funnel?.[step] ?? 0), 0),
      ]),
    ) as Funnel,
    /** Días del rango sin embudo (calculados antes de que existiera). */
    daysWithoutFunnel: days.filter((day) => !day.funnel).length,
  };
}
