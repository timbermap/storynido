import { CURRENCY_MINOR_UNITS, type Currency } from '../currency';
import type { OrderStatus } from '../order-status';

import { CHANNELS } from './channels';

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
  /** Proveedor de pago del pedido (`dodo`, `gumroad`, `mock`…). Sin él, el previsto. */
  paymentProvider?: string;
  /** Comisión real del cobro (USD, centavos), si el procesador la informó (PayPal). */
  paymentFeeUsdMinor?: number;
  /** Producto para la tabla por producto (`metricsProductKey`). */
  product?: string;
  /** IA gastada en este pedido (generación del libro), en millonésimas de USD. */
  aiCostUsdMicros?: number;
  /**
   * Parte de `aiCostUsdMicros` que gastó la generación (pasos del pipeline, con sus reparaciones
   * automáticas): `costsUsdMicros.ai` del pedido. Lo que sobra son páginas rehechas después.
   */
  aiPipelineUsdMicros?: number;
  /** Estilo de ilustración del libro comprado (DECISIONS 268). */
  style?: string | null;
}

/**
 * Comisión de cada proveedor de pago con tarjeta no estadounidense, publicada al 16 nov 2026
 * (flaviocopes.com/payment-provider-fees). Es una estimación hasta guardar la comisión real de
 * cada cobro. `mock` y los desconocidos usan la del proveedor en uso (PayPal), para que la
 * contribución de staging se parezca a la real.
 */
export const PAYMENT_FEES: Record<string, { percent: number; fixedUsd: number }> = {
  // PayPal Argentina, verificado en la cuenta de Sebas (19 nov 2026): 5,4 % + USD 0,30.
  paypal: { percent: 5.4, fixedUsd: 0.3 },
  dodo: { percent: 5.5, fixedUsd: 0.4 },
  gumroad: { percent: 12.9, fixedUsd: 0.8 },
  creem: { percent: 3.9, fixedUsd: 0.4 },
  paddle: { percent: 5, fixedUsd: 0.5 },
  polar: { percent: 6.5, fixedUsd: 0.5 },
};

export const DEFAULT_PAYMENT_PROVIDER = 'paypal';

/** Comisión estimada de un cobro (USD). Un reembolso no la devuelve. */
export function estimatePaymentFeeUsd(totalUsd: number, provider?: string): number {
  if (totalUsd <= 0) return 0;
  const fee = PAYMENT_FEES[provider ?? ''] ?? PAYMENT_FEES[DEFAULT_PAYMENT_PROVIDER];
  return fee ? (totalUsd * fee.percent) / 100 + fee.fixedUsd : 0;
}

/**
 * Producto de un pedido para la tabla por producto. Celebraciones se separa por lo que se cobró
 * (kit completo, invitación sola, piezas extra, tarjetas impresas); los libros por extensión,
 * tipo de contenido y formato, con `pro_` delante en Profesionales.
 */
export function metricsProductKey(input: {
  channel: string;
  format: string | null;
  components: readonly string[];
  discountReason: string | null;
  length: string | null;
  contentType: string | null;
}): string {
  if (input.components.includes('cards')) return 'event_cards';
  if (input.channel === 'events') {
    if (!input.components.includes('design')) return 'event_extra';
    if (!input.components.includes('piece')) return 'event_invitation';
    return input.discountReason === 'bundle' ? 'event_kit' : 'event_kit_partial';
  }
  const prefix = input.channel === 'professionals' ? 'pro_' : '';
  const content = input.contentType && input.contentType !== 'story' ? `${input.contentType}_` : '';
  return `${prefix}${content}${input.length ?? 'classic'}_${input.format ?? 'digital'}`;
}

/** Lo vendido de un producto en el período (USD). */
export interface ProductMetrics {
  units: number;
  revenueUsd: number;
  taxUsd: number;
  feeUsd: number;
  aiUsd: number;
  /** IA de páginas rehechas después de la generación: aparte, no entra en la contribución. */
  aiRedoUsd?: number;
  printUsd: number;
}

/** Pagos simulados (staging, pruebas): no son ventas y no entran en las métricas. */
export const TEST_PAYMENT_PROVIDERS: readonly string[] = ['mock'];

/**
 * IA del libro y de páginas rehechas (USD). Sin el gasto del pipeline (pedidos viejos), todo
 * cuenta como IA del libro.
 */
export function splitOrderAiUsd(order: MetricsOrder): { aiUsd: number; aiRedoUsd: number } {
  const total = (order.aiCostUsdMicros ?? 0) / 1_000_000;
  if (order.aiPipelineUsdMicros === undefined) return { aiUsd: total, aiRedoUsd: 0 };
  const pipeline = order.aiPipelineUsdMicros / 1_000_000;
  return { aiUsd: pipeline, aiRedoUsd: Math.max(0, total - pipeline) };
}

/** Sube cuando cambia el cálculo: los días guardados con otra versión se recalculan. */
export const METRICS_VERSION = 5;

/** A los N días un día queda congelado (ya no se esperan reembolsos ni cambios). */
export const METRICS_SETTLE_DAYS = 35;

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
  /** Línea por la que se creó (lo anterior es de Familias). */
  channel?: string;
  /** Estilo de ilustración elegido (DECISIONS 268). */
  style?: string | null;
}

/** Por estilo de ilustración: qué eligen y qué compran (DECISIONS 268). */
export interface StyleMetrics {
  /** Libros creados ese día con ese estilo que llegaron a la lámina del personaje. */
  chosen: number;
  /** Muestras completas (portada y páginas) con ese estilo. */
  previews: number;
  /** Pedidos pagados de libros con ese estilo. */
  purchased: number;
  revenueUsd: number;
}

/** Libros sin estilo guardado (borradores viejos o actividades) van como «sin estilo». */
export const NO_STYLE = 'sin-estilo';

/**
 * metricsDaily/{AAAA-MM-DD}: agregados del día. Se recalcula en cada visita hasta
 * METRICS_SETTLE_DAYS días después (reembolsos y cambios de estado), y después queda guardado.
 */
export interface DayMetrics {
  /** Versión del cálculo (ausente = 1). */
  version?: number;
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
  /** Ingresos sin impuestos − IA − impresión y envío (cálculo anterior, sin comisión de pago). */
  marginUsd: number;
  taxUsd: number;
  /** Comisión estimada de los cobros del día, reembolsados incluidos (no se devuelve). */
  paymentFeeUsd: number;
  /** IA de los libros generados para pedidos ese día. */
  aiBooksUsd: number;
  /** IA de muestras y personajes (lo que no está atado a un pedido), compradas o no. */
  aiPreviewsUsd: number;
  /** Total cobrado de los pedidos del día que se reembolsaron (ya fuera de las ventas). */
  refundedUsd: number;
  /** Lo que queda: ventas − impuestos − comisión − toda la IA − impresión y envío. */
  contributionUsd: number;
  /** Por producto (`metricsProductKey`). */
  products: Record<string, ProductMetrics>;
  /** Embudo por línea (ausente en días calculados antes). */
  funnelByChannel?: Record<string, Funnel>;
  /** Por estilo de ilustración (ausente en días calculados antes). */
  styles?: Record<string, StyleMetrics>;
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

/** Comisión real si el procesador la informó (PayPal); si no, la estimada por proveedor. */
function orderFeeUsd(order: MetricsOrder, totalUsd: number): number {
  return typeof order.paymentFeeUsdMinor === 'number'
    ? order.paymentFeeUsdMinor / 100
    : estimatePaymentFeeUsd(totalUsd, order.paymentProvider);
}

export function aggregateDay(input: {
  day: string;
  final: boolean;
  orders: readonly MetricsOrder[];
  previews: number;
  aiCostUsdMicros: number;
  /** Parte de `aiCostUsdMicros` atada a pedidos (generación de libros). */
  aiOrdersUsdMicros?: number;
  fx: FxRates;
  /** Libros creados ese día. */
  books?: readonly FunnelBook[];
}): DayMetrics {
  const orders = input.orders.filter(
    (order) => !TEST_PAYMENT_PROVIDERS.includes(order.paymentProvider ?? ''),
  );
  const sold = orders.filter((order) => REVENUE_ORDER_STATUSES.includes(order.status));
  const revenueByCurrency: Partial<Record<Currency, number>> = {};
  const revenueUsdByCountry: Record<string, number> = {};
  const ordersByChannel: Record<string, number> = {};
  const products: Record<string, ProductMetrics> = {};
  let revenueUsd = 0;
  let taxUsd = 0;
  let printUsd = 0;
  let feeUsd = 0;
  for (const order of sold) {
    const total = toUsd(order.amounts.totalMinor, order.currency, input.fx);
    const tax = toUsd(order.amounts.taxMinor, order.currency, input.fx);
    const print = (order.printCostUsdMinor ?? 0) / 100;
    const fee = orderFeeUsd(order, total);
    revenueUsd += total;
    taxUsd += tax;
    printUsd += print;
    feeUsd += fee;
    revenueByCurrency[order.currency] =
      (revenueByCurrency[order.currency] ?? 0) + order.amounts.totalMinor;
    revenueUsdByCountry[order.country] = round((revenueUsdByCountry[order.country] ?? 0) + total);
    ordersByChannel[order.channel] = (ordersByChannel[order.channel] ?? 0) + 1;
    const key = order.product ?? 'other';
    const current = products[key] ?? {
      units: 0,
      revenueUsd: 0,
      taxUsd: 0,
      feeUsd: 0,
      aiUsd: 0,
      aiRedoUsd: 0,
      printUsd: 0,
    };
    const ai = splitOrderAiUsd(order);
    products[key] = {
      units: current.units + 1,
      revenueUsd: round(current.revenueUsd + total),
      taxUsd: round(current.taxUsd + tax),
      feeUsd: round(current.feeUsd + fee),
      aiUsd: round(current.aiUsd + ai.aiUsd),
      aiRedoUsd: round((current.aiRedoUsd ?? 0) + ai.aiRedoUsd),
      printUsd: round(current.printUsd + print),
    };
  }
  // Un reembolso no devuelve la comisión: se resta igual.
  const refunded = orders.filter((order) => order.status === 'refunded');
  let refundedUsd = 0;
  for (const order of refunded) {
    const total = toUsd(order.amounts.totalMinor, order.currency, input.fx);
    refundedUsd += total;
    feeUsd += orderFeeUsd(order, total);
  }
  const aiCostUsd = input.aiCostUsdMicros / 1_000_000;
  const aiBooksUsd = Math.min(aiCostUsd, (input.aiOrdersUsdMicros ?? 0) / 1_000_000);
  const netRevenueUsd = revenueUsd - taxUsd;
  const byChannel = (channel: string) => ({
    books: (input.books ?? []).filter((book) => (book.channel ?? 'families') === channel),
    orders: orders.filter((order) => order.channel === channel),
  });
  const funnelOf = (books: readonly FunnelBook[], orders: readonly MetricsOrder[]): Funnel => ({
    started: books.length,
    character: books.filter((book) => book.character).length,
    preview: books.filter((book) => book.preview).length,
    approved: books.filter((book) => book.approved).length,
    // Pedidos creados ese día (cualquier estado) y los que se pagaron.
    checkout: orders.length,
    purchased: orders.filter((order) => REVENUE_ORDER_STATUSES.includes(order.status)).length,
  });
  const styles: Record<string, StyleMetrics> = {};
  const style = (key: string | null | undefined) =>
    (styles[key?.trim() ? key : NO_STYLE] ??= {
      chosen: 0,
      previews: 0,
      purchased: 0,
      revenueUsd: 0,
    });
  for (const book of input.books ?? []) {
    if (book.character) style(book.style).chosen += 1;
    if (book.preview) style(book.style).previews += 1;
  }
  for (const order of sold) {
    const entry = style(order.style);
    entry.purchased += 1;
    entry.revenueUsd = round(
      entry.revenueUsd + toUsd(order.amounts.totalMinor, order.currency, input.fx),
    );
  }
  return {
    version: METRICS_VERSION,
    day: input.day,
    final: input.final,
    orders: sold.length,
    refunds: refunded.length,
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
    taxUsd: round(taxUsd),
    paymentFeeUsd: round(feeUsd),
    aiBooksUsd: round(aiBooksUsd),
    aiPreviewsUsd: round(aiCostUsd - aiBooksUsd),
    refundedUsd: round(refundedUsd),
    contributionUsd: round(netRevenueUsd - feeUsd - aiCostUsd - printUsd),
    products,
    fxSource: input.fx.source,
    fxDate: input.fx.date,
    ...(input.books
      ? {
          funnel: funnelOf(input.books, orders),
          funnelByChannel: Object.fromEntries(
            CHANNELS.map((channel) => {
              const { books, orders } = byChannel(channel);
              return [channel, funnelOf(books, orders)];
            }),
          ),
          styles,
        }
      : {}),
  };
}

const emptyFunnel = (): Funnel =>
  Object.fromEntries(FUNNEL_STEPS.map((step) => [step, 0])) as Funnel;

/** Totales de un rango (los promedios se recalculan sobre la suma, no se promedian promedios). */
export function sumMetrics(days: readonly DayMetrics[]) {
  const total = (key: 'orders' | 'refunds' | 'previews') =>
    days.reduce((sum, day) => sum + day[key], 0);
  const money = (
    key:
      | 'revenueUsd'
      | 'netRevenueUsd'
      | 'aiCostUsd'
      | 'printCostUsd'
      | 'marginUsd'
      | 'taxUsd'
      | 'paymentFeeUsd'
      | 'aiBooksUsd'
      | 'aiPreviewsUsd'
      | 'refundedUsd'
      | 'contributionUsd',
  ) => round(days.reduce((sum, day) => sum + day[key], 0));
  const orders = total('orders');
  const previews = total('previews');
  const revenueUsdByCountry: Record<string, number> = {};
  for (const day of days) {
    for (const [country, value] of Object.entries(day.revenueUsdByCountry)) {
      revenueUsdByCountry[country] = round((revenueUsdByCountry[country] ?? 0) + value);
    }
  }
  const products: Record<string, ProductMetrics> = {};
  const funnelByChannel: Record<string, Funnel> = {};
  const styles: Record<string, StyleMetrics> = {};
  for (const day of days) {
    for (const [key, value] of Object.entries(day.styles ?? {})) {
      const current = styles[key] ?? { chosen: 0, previews: 0, purchased: 0, revenueUsd: 0 };
      styles[key] = {
        chosen: current.chosen + value.chosen,
        previews: current.previews + value.previews,
        purchased: current.purchased + value.purchased,
        revenueUsd: round(current.revenueUsd + value.revenueUsd),
      };
    }
    for (const [key, value] of Object.entries(day.products)) {
      const current = products[key];
      products[key] = current
        ? {
            units: current.units + value.units,
            revenueUsd: round(current.revenueUsd + value.revenueUsd),
            taxUsd: round(current.taxUsd + value.taxUsd),
            feeUsd: round(current.feeUsd + value.feeUsd),
            aiUsd: round(current.aiUsd + value.aiUsd),
            aiRedoUsd: round((current.aiRedoUsd ?? 0) + (value.aiRedoUsd ?? 0)),
            printUsd: round(current.printUsd + value.printUsd),
          }
        : { ...value };
    }
    for (const [channel, funnel] of Object.entries(day.funnelByChannel ?? {})) {
      const current = funnelByChannel[channel] ?? emptyFunnel();
      funnelByChannel[channel] = Object.fromEntries(
        FUNNEL_STEPS.map((step) => [step, current[step] + funnel[step]]),
      ) as Funnel;
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
    taxUsd: money('taxUsd'),
    paymentFeeUsd: money('paymentFeeUsd'),
    aiBooksUsd: money('aiBooksUsd'),
    aiPreviewsUsd: money('aiPreviewsUsd'),
    refundedUsd: money('refundedUsd'),
    contributionUsd: money('contributionUsd'),
    products,
    funnelByChannel,
    styles,
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
