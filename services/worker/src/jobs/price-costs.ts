import {
  ANY_COUNTRY,
  CARD_COPIES,
  COLLECTIONS,
  GLOBAL_DOC_ID,
  generatedPages,
  DEFAULT_EDITORIAL_CONFIG,
  editorialConfigSchema,
  type BookLength,
  type ContentType,
  aiUsageSchema,
  measuredAiCostPerPage,
  normalizeFirestoreData,
  printOptionSchema,
  printPageCount,
  productPricingSchema,
  utcDay,
  SAMPLE_PRINT_ADDRESSES,
  type OrderStatus,
  type PrintItem,
  type PrintOption,
  type PrintProvider,
} from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

const DAY_MS = 24 * 60 * 60 * 1000;
/** El precio al cliente cambia solo si el costo se mueve más de 5 %, como mucho una vez por semana. */
const CHANGE_THRESHOLD = 0.05;
const MIN_DAYS_BETWEEN_CHANGES = 7;

/** ¿Se publica el costo nuevo? Solo si se movió más de 5 % y pasó una semana del último cambio. */
export function shouldChange(
  current: number,
  next: number,
  lastChange: Date | null,
  now: Date,
): boolean {
  if (current <= 0) return next > 0;
  if (Math.abs(next - current) <= current * CHANGE_THRESHOLD) return false;
  return !lastChange || now.getTime() - lastChange.getTime() >= MIN_DAYS_BETWEEN_CHANGES * DAY_MS;
}
/** Cuánto espera la cotización de una imprenta antes de darla por fallida. */
const QUOTE_TIMEOUT_MS = 20_000;
/** Pedidos que cuentan como libro pagado (no los cancelados, reembolsados ni sin pagar). */
const PAID: readonly OrderStatus[] = [
  'paid',
  'generating',
  'qa_failed',
  'ready',
  'sent_to_print',
  'in_production',
  'shipped',
  'delivered',
];

interface Alert {
  key: string;
  kind: string;
  orderId: string | null;
  message: string;
}

/** Lo que se cotiza para actualizar una fila de la matriz: un ejemplar típico de ese formato. */
export function sampleItem(option: Pick<PrintOption, 'format' | 'pages'>): PrintItem {
  if (option.format === 'card') {
    return { format: 'card', piece: 'invitation', pageCount: 1, quantity: CARD_COPIES.min };
  }
  // Un libro clásico (28 páginas); el cuento grapado, de 12 (16 con las tapas).
  const wanted = Math.max(
    option.pages.min,
    option.format === 'booklet' ? printPageCount('booklet', 12) : 28,
  );
  const pageCount = Math.ceil(wanted / option.pages.multipleOf) * option.pages.multipleOf;
  return { format: option.format, pageCount, quantity: 1 };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`La imprenta no respondió en ${String(ms / 1000)} s`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Costos que siguen solos a la realidad (DECISIONS 241), una vez por día: la matriz de imprentas
 * con lo que cotiza cada imprenta hoy y el costo de IA por página con lo que se gastó de verdad.
 * El margen nunca cambia solo: el precio al cliente sigue al costo. Los pedidos ya pagados
 * quedan con su precio congelado.
 */
export class PriceCostRefresh {
  constructor(
    private readonly db: Firestore,
    private readonly printers: () => readonly PrintProvider[],
    private readonly notifier: { adminAlert(alert: Alert): Promise<unknown> },
    private readonly log: FastifyBaseLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run() {
    return { printCosts: await this.printCosts(), aiCost: await this.aiCost() };
  }

  /**
   * Vuelve a cotizar cada fila habilitada de la matriz (país × formato × imprenta) con la
   * dirección de ejemplo del país. Si una cotización falla, queda el valor anterior y se avisa.
   */
  async printCosts() {
    const now = this.now();
    const printers = new Map(this.printers().map((printer) => [printer.id, printer]));
    const snapshot = await this.db.collection(COLLECTIONS.printOptions).get();
    const updated: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const doc of snapshot.docs) {
      const parsed = printOptionSchema.safeParse(normalizeFirestoreData(doc.data()));
      if (!parsed.success) continue;
      const option = parsed.data;
      if (!option.enabled || option.country === ANY_COUNTRY) continue;
      const printer = printers.get(option.provider);
      const sample = SAMPLE_PRINT_ADDRESSES[option.country];
      if (!printer || !sample) continue;
      const item = sampleItem(option);
      const previous = option.autoPricing ?? {
        updatedAt: null,
        previousCostUsdMinor: null,
        previousEtaDaysMin: null,
        previousEtaDaysMax: null,
        quotedCostUsdMinor: null,
        quotedAt: null,
        failedAt: null,
        error: null,
      };
      try {
        const quoted = await withTimeout(
          printer.quote([item], { ...sample, country: option.country }, 'USD'),
          QUOTE_TIMEOUT_MS,
        );
        const cost = Math.round(quoted.productionCostUsdMinor / item.quantity);
        // El plazo se actualiza siempre; el costo (que mueve el precio), con la regla del 5 %.
        const change = shouldChange(
          option.productionCostUsdMinor,
          cost,
          option.autoPricing?.updatedAt ?? null,
          now,
        );
        await doc.ref.update({
          etaDaysMin: quoted.etaDaysMin,
          etaDaysMax: quoted.etaDaysMax,
          ...(change
            ? {
                productionCostUsdMinor: cost,
                autoPricing: {
                  updatedAt: now,
                  previousCostUsdMinor: option.productionCostUsdMinor,
                  previousEtaDaysMin: option.etaDaysMin,
                  previousEtaDaysMax: option.etaDaysMax,
                  quotedCostUsdMinor: cost,
                  quotedAt: now,
                  failedAt: null,
                  error: null,
                },
              }
            : {
                autoPricing: { ...previous, quotedCostUsdMinor: cost, quotedAt: now, error: null },
              }),
          updatedAt: now,
        });
        if (change) updated.push(doc.id);
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
        failed.push({ id: doc.id, error: message });
        this.log.warn({ printOption: doc.id, err: error }, 'print cost refresh failed');
        await doc.ref.update({ autoPricing: { ...previous, failedAt: now, error: message } });
      }
    }
    if (failed.length > 0) {
      await this.notifier.adminAlert({
        key: `alert:print_costs:${utcDay(now)}`,
        kind: 'print_costs',
        orderId: null,
        message: `No se pudo actualizar el costo de ${String(failed.length)} imprenta(s): ${failed
          .map((item) => `${item.id} (${item.error})`)
          .join('; ')}. Quedan con el valor anterior (Admin → Imprentas).`,
      });
    }
    return { updated: updated.length, failed: failed.map((item) => item.id) };
  }

  /**
   * Costo de IA por página generada medido con los libros pagados de los últimos 30 días. Se guarda en
   * cada producto y, salvo que esté fijado a mano, pasa a ser el costo con el que se calcula el
   * precio. Con menos de 20 libros con datos queda el valor actual.
   */
  async aiCost() {
    const now = this.now();
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const orders = await this.db
      .collection(COLLECTIONS.orders)
      .where('createdAt', '>=', since)
      .get();
    const bookIds = [
      ...new Set(
        orders.docs
          .filter((doc) => PAID.includes(doc.get('status') as OrderStatus))
          .filter((doc) => doc.get('channel') !== 'events')
          .map((doc) => String(doc.get('bookId'))),
      ),
    ];
    // La configuración editorial vigente (la del admin pisa la de fábrica clave por clave).
    const stored: unknown = (
      await this.db.collection(COLLECTIONS.editorialConfig).doc(GLOBAL_DOC_ID).get()
    ).data();
    const parsedEditorial = editorialConfigSchema.safeParse({
      ...DEFAULT_EDITORIAL_CONFIG,
      ...(stored && typeof stored === 'object' ? stored : {}),
    });
    const editorial = parsedEditorial.success ? parsedEditorial.data : DEFAULT_EDITORIAL_CONFIG;
    // Páginas con ilustración generada de cada libro (las fijas y las de actividades no cuentan).
    const books = (
      await Promise.all(
        bookIds.map(async (bookId) => {
          const book = await this.db.collection(COLLECTIONS.books).doc(bookId).get();
          const interiorPages = Number(book.get('preview.interiorPages') ?? 0);
          const pages =
            interiorPages > 0
              ? generatedPages(
                  {
                    length: (book.get('length') as BookLength | undefined) ?? null,
                    contentType: (book.get('contentType') as ContentType | undefined) ?? null,
                    interiorPages,
                    activityPages: Number(book.get('preview.activityPages') ?? 0),
                  },
                  editorial,
                )
              : 0;
          return { bookId, pages };
        }),
      )
    ).filter((book) => book.pages > 0);
    // La muestra puede ser de antes: se miran 60 días de llamadas de esos libros.
    const usage = await this.db
      .collection(COLLECTIONS.aiUsage)
      .where('at', '>=', new Date(now.getTime() - 60 * DAY_MS))
      .get();
    const records = usage.docs.flatMap((doc) => {
      const parsed = aiUsageSchema.safeParse(normalizeFirestoreData(doc.data()));
      return parsed.success ? [parsed.data] : [];
    });
    const measured = measuredAiCostPerPage(records, books);
    const pricing = await this.db.collection(COLLECTIONS.productPricing).get();
    const applied: string[] = [];
    for (const doc of pricing.docs) {
      const parsed = productPricingSchema.safeParse(normalizeFirestoreData(doc.data()));
      if (!parsed.success || !measured) continue;
      const product = parsed.data;
      // Con la regla del 5 % y una vez por semana; fijado a mano, solo se informa.
      const apply =
        !product.aiCostManual &&
        shouldChange(
          product.aiCostPerPageUsdMinor,
          measured.perPageUsdMinor,
          product.aiCostAuto?.appliedAt ?? null,
          now,
        );
      await doc.ref.update({
        aiCostAuto: {
          perPageUsdMinor: measured.perPageUsdMinor,
          books: measured.books,
          updatedAt: now,
          previousUsdMinor: apply ? product.aiCostPerPageUsdMinor : null,
          appliedAt: apply ? now : (product.aiCostAuto?.appliedAt ?? null),
        },
        ...(apply ? { aiCostPerPageUsdMinor: measured.perPageUsdMinor, updatedAt: now } : {}),
      });
      if (apply) applied.push(doc.id);
    }
    this.log.info({ measured, books: books.length, applied }, 'ai cost refresh');
    return { measured, applied };
  }
}
