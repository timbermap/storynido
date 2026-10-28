import {
  COLLECTIONS,
  aggregateDay,
  aiCostReport,
  aiUsageSchema,
  normalizeFirestoreData,
  utcDay,
  type Currency,
  type DayMetrics,
  type FxRates,
  type MetricsOrder,
  type OrderStatus,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

/** Cotizaciones a USD de un día (null si no se pudieron obtener). */
export type FxSource = () => Promise<Partial<Record<Currency, number>> | null>;

/** ExchangeRate-API, acceso abierto (sin clave; pide atribución): una cotización por día. */
export const openExchangeRates: FxSource = async () => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await response.json()) as { result?: string; rates?: Record<string, number> };
    return data.result === 'success' && data.rates ? data.rates : null;
  } catch {
    return null;
  }
};

export const FX_SOURCE = 'open.er-api.com (ExchangeRate-API)';
const DAY_MS = 24 * 3600 * 1000;

const dayStart = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Dashboard del admin (fase 14): agregados por día. Los días cerrados se guardan en
 * metricsDaily y no se recalculan; hoy se calcula en vivo. Escala porque cada consulta
 * lee a lo sumo los pedidos de un día.
 */
export class MetricsService {
  constructor(
    private readonly db: Firestore,
    private readonly fxSource: FxSource = openExchangeRates,
  ) {}

  /** Cotización del día: guardada, o se consulta y se guarda; si falla, la última conocida. */
  async fx(day: string): Promise<FxRates> {
    const ref = this.db.collection(COLLECTIONS.fxRates).doc(day);
    const stored = (await ref.get()).data() as FxRates | undefined;
    if (stored) return stored;
    // Solo se consulta la de hoy (la fuente abierta no da históricos).
    if (day === utcDay()) {
      const rates = await this.fxSource();
      if (rates) {
        const fresh: FxRates = { rates, source: FX_SOURCE, date: day };
        await ref.set(fresh);
        return fresh;
      }
    }
    const previous = await this.db
      .collection(COLLECTIONS.fxRates)
      .where('date', '<=', day)
      .orderBy('date', 'desc')
      .limit(1)
      .get();
    const latest =
      (previous.docs[0]?.data() as FxRates | undefined) ??
      ((
        await this.db.collection(COLLECTIONS.fxRates).orderBy('date', 'desc').limit(1).get()
      ).docs[0]?.data() as FxRates | undefined);
    return latest ?? { rates: { USD: 1 }, source: 'sin cotización', date: day };
  }

  private async compute(day: string, final: boolean): Promise<DayMetrics> {
    const start = dayStart(day);
    const end = new Date(start.getTime() + DAY_MS);
    const [orders, usage, budget, fx] = await Promise.all([
      this.db
        .collection(COLLECTIONS.orders)
        .where('createdAt', '>=', start)
        .where('createdAt', '<', end)
        .get(),
      this.db.collection(COLLECTIONS.aiUsage).where('day', '==', day).get(),
      this.db.collection(COLLECTIONS.aiBudget).doc(day).get(),
      this.fx(day),
    ]);
    const previewBooks = new Set(
      usage.docs
        .filter((doc) => !doc.get('orderId') && doc.get('bookId'))
        .map((doc) => String(doc.get('bookId'))),
    );
    return aggregateDay({
      day,
      final,
      previews: previewBooks.size,
      aiCostUsdMicros: Number(budget.get('spentUsdMicros') ?? 0),
      fx,
      orders: orders.docs.map((doc): MetricsOrder => {
        const data = doc.data();
        const routing = data.printRouting as { totalCostUsdMinor?: number } | undefined;
        const amounts = (data.amounts ?? {}) as { totalMinor?: number; taxMinor?: number };
        return {
          status: data.status as OrderStatus,
          channel: typeof data.channel === 'string' ? data.channel : 'families',
          country: String(data.country),
          currency: data.currency as Currency,
          amounts: { totalMinor: amounts.totalMinor ?? 0, taxMinor: amounts.taxMinor ?? 0 },
          printCostUsdMinor: routing?.totalCostUsdMinor ?? null,
        };
      }),
    });
  }

  /** Los últimos N días (hoy incluido, en vivo). Los cerrados se leen de metricsDaily. */
  async range(days: number, today = utcDay()): Promise<DayMetrics[]> {
    const list = Array.from({ length: days }, (_, index) =>
      utcDay(new Date(dayStart(today).getTime() - (days - 1 - index) * DAY_MS)),
    );
    const collection = this.db.collection(COLLECTIONS.metricsDaily);
    const stored = await Promise.all(list.map((day) => collection.doc(day).get()));
    return Promise.all(
      list.map(async (day, index) => {
        const doc = stored[index];
        if (doc?.exists) return doc.data() as DayMetrics;
        const final = day < today;
        const metrics = await this.compute(day, final);
        if (final) await collection.doc(day).set(metrics);
        return metrics;
      }),
    );
  }

  /** Costo real de IA por muestra y por libro en los últimos N días. */
  async aiCosts(days: number) {
    const since = new Date(Date.now() - days * DAY_MS);
    const snapshot = await this.db.collection(COLLECTIONS.aiUsage).where('at', '>=', since).get();
    const records = snapshot.docs.flatMap((doc) => {
      const parsed = aiUsageSchema.safeParse(normalizeFirestoreData(doc.data()));
      return parsed.success ? [parsed.data] : [];
    });
    return aiCostReport(records);
  }
}
