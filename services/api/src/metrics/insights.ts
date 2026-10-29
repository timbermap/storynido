import {
  COLLECTIONS,
  REVENUE_ORDER_STATUSES,
  toUsd,
  utcDay,
  type Currency,
  type OrderStatus,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import type { MetricsService } from './service';

const DAY_MS = 24 * 3600 * 1000;
const round = (value: number) => Math.round(value * 100) / 100;
const rate = (numerator: number, denominator: number) =>
  denominator ? round((numerator / denominator) * 100) : null;
const bump = (record: Record<string, number>, key: string, by = 1) => {
  record[key] = (record[key] ?? 0) + by;
};

/** Pedidos que llegaron a generarse (para las tasas de calidad del libro final). */
const GENERATED: readonly OrderStatus[] = [...REVENUE_ORDER_STATUSES, 'refunded'];

/**
 * Operación (fase 15): calidad (informe §10), imprenta por proveedor, formato y país, y ventas
 * por canal. Solo cuenta códigos y totales: ningún dato del niño.
 */
export class InsightsService {
  constructor(
    private readonly db: Firestore,
    private readonly metrics: MetricsService,
  ) {}

  async report(days: number) {
    const since = new Date(Date.now() - days * DAY_MS);
    const [ordersSnap, qaSnap, usageSnap, fx] = await Promise.all([
      this.db.collection(COLLECTIONS.orders).where('createdAt', '>=', since).get(),
      this.db.collectionGroup(COLLECTIONS.qaEvents).where('at', '>=', since).get(),
      this.db
        .collection(COLLECTIONS.aiUsage)
        .where('at', '>=', since)
        .where('kind', '==', 'character')
        .get(),
      this.metrics.fx(utcDay()),
    ]);

    // Códigos de QA por libro (la ruta es books/{bookId}/qaEvents/{id}).
    const qaCodes: Record<string, number> = {};
    const booksWith = new Map<string, Set<string>>();
    for (const doc of qaSnap.docs) {
      const code = String(doc.get('code'));
      bump(qaCodes, code);
      const bookId = doc.ref.parent.parent?.id;
      if (!bookId) continue;
      if (!booksWith.has(code)) booksWith.set(code, new Set());
      booksWith.get(code)?.add(bookId);
    }
    const withCode = (...codes: string[]) =>
      new Set(codes.flatMap((code) => [...(booksWith.get(code) ?? [])]));

    const previews = new Set(
      usageSnap.docs.filter((doc) => !doc.get('orderId')).map((doc) => String(doc.get('bookId'))),
    );
    const approved = withCode('character_approved');
    const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    const generated = orders.filter((order) =>
      GENERATED.includes(order.data.status as OrderStatus),
    );
    const orderedBooks = new Set(generated.map((order) => String(order.data.bookId)));
    const inOrdered = (books: Set<string>) =>
      [...books].filter((bookId) => orderedBooks.has(bookId)).length;

    const visual = withCode('page_human_review', 'page_needs_reference');
    const narrative = withCode('name_mismatch', 'length_out_of_range', 'layout_blocked');
    const mismatch = withCode('snapshot_mismatch');
    const edited = withCode('text_edited');
    const quality = [
      {
        metric: 'preview_character_approval_rate',
        value: rate(approved.size, previews.size),
        numerator: approved.size,
        denominator: previews.size,
        note: 'Muestras con el personaje aprobado ÷ muestras creadas.',
      },
      {
        metric: 'character_regenerations_per_book',
        value: previews.size ? round((qaCodes.character_corrected ?? 0) / previews.size) : null,
        numerator: qaCodes.character_corrected ?? 0,
        denominator: previews.size,
        note: 'Correcciones del personaje por muestra (no es porcentaje).',
      },
      {
        metric: 'preview_feedback_likeness_rate',
        value: rate(withCode('feedback_likeness').size, previews.size),
        numerator: withCode('feedback_likeness').size,
        denominator: previews.size,
        note: 'Muestras en las que respondieron "No se parece" en "¿Qué mejorarías?".',
      },
      {
        metric: 'story_edit_rate',
        value: rate(edited.size, approved.size),
        numerator: edited.size,
        denominator: approved.size,
        note: 'Muestras completas en las que el adulto editó al menos una página.',
      },
      {
        metric: 'critical_visual_issue_rate',
        value: rate(inOrdered(visual), orderedBooks.size),
        numerator: inOrdered(visual),
        denominator: orderedBooks.size,
        note: 'Libros pedidos con una página que fue a revisión humana.',
      },
      {
        metric: 'critical_narrative_issue_rate',
        value: rate(inOrdered(narrative), orderedBooks.size),
        numerator: inOrdered(narrative),
        denominator: orderedBooks.size,
        note: 'Libros pedidos con nombre mal escrito, largo fuera de rango o maqueta bloqueada.',
      },
      {
        metric: 'preview_final_mismatch_rate',
        value: rate(inOrdered(mismatch), orderedBooks.size),
        numerator: inOrdered(mismatch),
        denominator: orderedBooks.size,
        note: 'Objetivo 0: lo pagado distinto de lo aprobado.',
      },
      {
        metric: 'support_case_rate',
        value: null,
        numerator: 0,
        denominator: generated.length,
        note: 'Sin sistema de soporte conectado todavía.',
      },
    ];

    // Imprenta: por proveedor, formato y país.
    const print = new Map<
      string,
      {
        provider: string;
        format: string;
        country: string;
        orders: number;
        failed: number;
        cancelled: number;
      }
    >();
    for (const { data } of orders) {
      const routing = data.printRouting as { provider?: string } | undefined;
      const provider =
        (data.print as { provider?: string } | null | undefined)?.provider ?? routing?.provider;
      if (!provider) continue;
      for (const item of (data.items ?? []) as { format: string }[]) {
        if (item.format === 'digital') continue;
        const key = `${provider}|${item.format}|${String(data.country)}`;
        const entry = print.get(key) ?? {
          provider,
          format: item.format,
          country: String(data.country),
          orders: 0,
          failed: 0,
          cancelled: 0,
        };
        entry.orders += 1;
        const failedStep = (data.pipeline as { failedStep?: string } | undefined)?.failedStep;
        if (data.status === 'qa_failed' && failedStep === 'deliver') entry.failed += 1;
        if (data.status === 'cancelled') entry.cancelled += 1;
        print.set(key, entry);
      }
    }

    // Canales: ventas, ticket y clientes que repiten (las compras recurrentes Pro).
    const channels = new Map<
      string,
      { orders: number; revenueUsd: number; owners: Map<string, number> }
    >();
    const formats: Record<string, number> = {};
    const soldBooks: string[] = [];
    for (const { data } of orders) {
      if (!REVENUE_ORDER_STATUSES.includes(data.status as OrderStatus)) continue;
      const channel = typeof data.channel === 'string' ? data.channel : 'families';
      const entry = channels.get(channel) ?? {
        orders: 0,
        revenueUsd: 0,
        owners: new Map<string, number>(),
      };
      entry.orders += 1;
      const amounts = (data.amounts ?? {}) as { totalMinor?: number };
      entry.revenueUsd += toUsd(amounts.totalMinor ?? 0, data.currency as Currency, fx);
      const owner = String(data.ownerUid);
      entry.owners.set(owner, (entry.owners.get(owner) ?? 0) + 1);
      channels.set(channel, entry);
      for (const item of (data.items ?? []) as { format: string }[]) bump(formats, item.format);
      soldBooks.push(String(data.bookId));
    }
    const lengths: Record<string, number> = {};
    const densities: Record<string, number> = {};
    const books = soldBooks.length
      ? await this.db.getAll(
          ...soldBooks.map((id) => this.db.collection(COLLECTIONS.books).doc(id)),
        )
      : [];
    for (const book of books) {
      if (!book.exists) continue;
      bump(lengths, String(book.get('length') ?? 'historia'));
      bump(densities, String(book.get('textDensity') ?? 'balanced'));
    }

    return {
      quality,
      qaCodes,
      print: [...print.values()]
        .map((entry) => ({ ...entry, failureRate: rate(entry.failed, entry.orders) ?? 0 }))
        .sort((a, b) => b.orders - a.orders),
      channels: [...channels].map(([channel, entry]) => ({
        channel,
        orders: entry.orders,
        revenueUsd: round(entry.revenueUsd),
        avgTicketUsd: entry.orders ? round(entry.revenueUsd / entry.orders) : 0,
        repeatCustomers: [...entry.owners.values()].filter((count) => count > 1).length,
      })),
      choices: { formats, lengths, densities },
    };
  }
}
