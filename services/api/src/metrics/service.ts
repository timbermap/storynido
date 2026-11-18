import {
  COLLECTIONS,
  METRICS_SETTLE_DAYS,
  METRICS_VERSION,
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
  metricsProductKey,
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

/** `in` de Firestore admite hasta 30 valores. */
const chunks = <T>(list: readonly T[], size = 30): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, index) =>
    list.slice(index * size, index * size + size),
  );

/**
 * Dashboard del admin: agregados por día. Un día se recalcula en cada visita hasta
 * METRICS_SETTLE_DAYS días después (reembolsos, cancelaciones y cambios de estado cambian sus
 * números) y recién ahí queda guardado en metricsDaily. Un día guardado con otra versión del
 * cálculo también se recalcula. Cada cálculo lee a lo sumo los pedidos y libros de un día.
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
    const [orders, usage, budget, fx, books] = await Promise.all([
      this.db
        .collection(COLLECTIONS.orders)
        .where('createdAt', '>=', start)
        .where('createdAt', '<', end)
        .get(),
      this.db.collection(COLLECTIONS.aiUsage).where('day', '==', day).get(),
      this.db.collection(COLLECTIONS.aiBudget).doc(day).get(),
      this.fx(day),
      this.db
        .collection(COLLECTIONS.books)
        .where('createdAt', '>=', start)
        .where('createdAt', '<', end)
        .select(
          'preview.stage',
          'preview.character.approvedAt',
          'preview.characterImagePath',
          'channel',
          'styleId',
        )
        .get(),
    ]);
    // Extensión y tipo de contenido de los libros comprados (para la tabla por producto) e IA
    // gastada en cada pedido (puede caer en otro día que su creación).
    const orderIds = orders.docs.map((doc) => doc.id);
    const bookIds = [...new Set(orders.docs.map((doc) => String(doc.get('bookId'))))];
    const [orderBooks, orderUsage] = await Promise.all([
      bookIds.length
        ? this.db.getAll(...bookIds.map((id) => this.db.collection(COLLECTIONS.books).doc(id)), {
            fieldMask: ['length', 'contentType', 'styleId'],
          })
        : Promise.resolve([]),
      Promise.all(
        chunks(orderIds).map((ids) =>
          this.db.collection(COLLECTIONS.aiUsage).where('orderId', 'in', ids).get(),
        ),
      ),
    ]);
    const bookInfo = new Map(
      orderBooks.map((doc) => [
        doc.id,
        {
          length: typeof doc.get('length') === 'string' ? String(doc.get('length')) : null,
          contentType:
            typeof doc.get('contentType') === 'string' ? String(doc.get('contentType')) : null,
          style: typeof doc.get('styleId') === 'string' ? String(doc.get('styleId')) : null,
        },
      ]),
    );
    const aiByOrder = new Map<string, number>();
    for (const doc of orderUsage.flatMap((snapshot) => snapshot.docs)) {
      const id = String(doc.get('orderId'));
      aiByOrder.set(id, (aiByOrder.get(id) ?? 0) + Number(doc.get('costUsdMicros') ?? 0));
    }
    const aiOrdersUsdMicros = usage.docs
      .filter((doc) => doc.get('orderId'))
      .reduce((sum, doc) => sum + Number(doc.get('costUsdMicros') ?? 0), 0);
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
      aiOrdersUsdMicros,
      fx,
      books: books.docs.map((doc) => {
        const preview = doc.get('preview') as
          | {
              stage?: string;
              character?: { approvedAt?: unknown } | null;
              characterImagePath?: string | null;
            }
          | null
          | undefined;
        return {
          character: Boolean(preview?.character ?? preview?.characterImagePath),
          // Las muestras anteriores a la lámina no tienen etapa: llegaron completas.
          preview: Boolean(preview && (preview.stage ?? 'complete') === 'complete'),
          approved: Boolean(preview?.character?.approvedAt),
          channel: typeof doc.get('channel') === 'string' ? String(doc.get('channel')) : 'families',
          style: typeof doc.get('styleId') === 'string' ? String(doc.get('styleId')) : null,
        };
      }),
      orders: orders.docs.map((doc): MetricsOrder => {
        const data = doc.data();
        const routing = data.printRouting as { totalCostUsdMinor?: number } | undefined;
        const amounts = (data.amounts ?? {}) as { totalMinor?: number; taxMinor?: number };
        const channel = typeof data.channel === 'string' ? data.channel : 'families';
        const snapshot = data.priceSnapshot as
          | { components?: { code: string }[]; discount?: { reason?: string | null } }
          | null
          | undefined;
        const items = (data.items ?? []) as { piece?: string; format?: string }[];
        const book = bookInfo.get(String(data.bookId));
        return {
          status: data.status as OrderStatus,
          channel,
          country: String(data.country),
          currency: data.currency as Currency,
          amounts: { totalMinor: amounts.totalMinor ?? 0, taxMinor: amounts.taxMinor ?? 0 },
          printCostUsdMinor: routing?.totalCostUsdMinor ?? null,
          paymentProvider: (data.payment as { provider?: string } | undefined)?.provider,
          product: metricsProductKey({
            channel,
            format:
              (items.find((item) => (item.piece ?? 'book') === 'book') ?? items[0])?.format ?? null,
            components: (snapshot?.components ?? []).map((component) => component.code),
            discountReason: snapshot?.discount?.reason ?? null,
            length: book?.length ?? null,
            contentType: book?.contentType ?? null,
          }),
          aiCostUsdMicros: aiByOrder.get(doc.id) ?? 0,
          style: book?.style ?? null,
        };
      }),
    });
  }

  /**
   * Los últimos N días (hoy incluido). Los asentados (más de METRICS_SETTLE_DAYS) se leen de
   * metricsDaily; los recientes se recalculan, porque un reembolso o un cambio de estado
   * posterior cambia sus números.
   */
  async range(days: number, today = utcDay()): Promise<DayMetrics[]> {
    const list = Array.from({ length: days }, (_, index) =>
      utcDay(new Date(dayStart(today).getTime() - (days - 1 - index) * DAY_MS)),
    );
    const settledBefore = utcDay(
      new Date(dayStart(today).getTime() - METRICS_SETTLE_DAYS * DAY_MS),
    );
    const collection = this.db.collection(COLLECTIONS.metricsDaily);
    const stored = await Promise.all(list.map((day) => collection.doc(day).get()));
    return Promise.all(
      list.map(async (day, index) => {
        const settled = day < settledBefore;
        const saved = stored[index]?.data() as DayMetrics | undefined;
        if (settled && saved?.version === METRICS_VERSION) return saved;
        const metrics = await this.compute(day, day < today);
        if (settled) await collection.doc(day).set(metrics);
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
