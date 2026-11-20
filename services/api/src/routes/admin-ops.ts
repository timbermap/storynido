import {
  COLLECTIONS,
  apiRoutes,
  normalizeFirestoreData,
  type AttentionItem,
} from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { auditedWrite } from '../admin/audit';
import { AiBudget } from '../ai/budget';
import { AppError } from '../errors';
import { InsightsService } from '../metrics/insights';
import { addRoute } from '../plugins/route';
import {
  buildPaypalReport,
  dateChunks,
  mergeTransactions,
  paypalReadError,
  withOrderOnDispute,
  type PaypalOrder,
} from '../admin/paypal-report';

type TestBody = z.output<(typeof apiRoutes)['adminTestIntegration']['body']>;
type QuoteBody = z.output<(typeof apiRoutes)['adminUpdateQuoteRequest']['body']>;

/** Dirección de ejemplo para cotizar (no se crea ningún pedido). */
const SAMPLE_US = {
  name: 'Prueba StoryNido',
  line1: '100 Congress Ave',
  line2: null,
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  country: 'US',
  phone: '+15125550100',
} as const;

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);

/** Un pedido pagado que lleva más que esto sin terminar de generarse está trabado. */
const STUCK_MS = 2 * 3600 * 1000;

const ALERT_TITLES: Record<string, string> = {
  payment_mismatch: 'Lo cobrado no coincide con el precio del pedido',
  payment_dispute: 'Contracargo abierto',
  print_failed: 'La imprenta informó una falla',
  pipeline_failed: 'La generación falló después de los reintentos',
};

const LEVEL_ORDER = { urgent: 0, review: 1, notice: 2 } as const;

/**
 * Operación (fase 15): prueba de conexión de los proveedores, cola de cotizaciones de Eventos
 * e indicadores de calidad, imprenta y canales.
 */
export function registerAdminOpsRoutes(app: FastifyInstance): void {
  const { db, providers, metrics } = app.deps;
  const insights = new InsightsService(db, metrics);

  addRoute(app, apiRoutes.adminTestIntegration, {}, async (request) => {
    const { kind, id } = request.body as TestBody;
    const started = Date.now();
    const done = (ok: boolean, detail: string) => ({ ok, detail, ms: Date.now() - started });
    try {
      switch (kind) {
        case 'print': {
          const printer = id ? providers.printer(id) : (providers.printers()[0] ?? null);
          if (!printer) return done(false, `La imprenta "${id ?? ''}" no está activa.`);
          const quote = await printer.quote(
            [{ format: 'softcover', pageCount: 28, quantity: 1 }],
            SAMPLE_US,
            'USD',
          );
          return done(
            true,
            `${printer.id}: cotiza USD ${(quote.totalCostUsdMinor / 100).toFixed(2)} a EE. UU. (sin crear pedidos).`,
          );
        }
        case 'email': {
          const email = providers.email();
          return done(
            true,
            `${email.id}: ${email.check ? await email.check() : 'simulado (no envía)'}`,
          );
        }
        case 'ai': {
          // Una moderación mínima: confirma credenciales y modelo (costo ínfimo).
          const text = providers.ai().text;
          const verdict = await text.moderateText('Hola');
          return done(
            true,
            `${text.id}: responde (moderación ${verdict.allowed ? 'ok' : 'rechazó'}).`,
          );
        }
        case 'storage': {
          const storage = providers.storage();
          await storage.exists({ bucket: 'assets', path: 'healthcheck/inexistente.txt' });
          return done(true, `${storage.id}: lectura ok.`);
        }
        case 'payment': {
          const payment = providers.payment();
          return done(
            true,
            `${payment.id}: ${payment.id === 'mock' ? 'simulado' : 'configurado'}.`,
          );
        }
      }
    } catch (error) {
      return done(
        false,
        error instanceof Error ? error.message.slice(0, 300) : 'Error desconocido',
      );
    }
  });

  addRoute(app, apiRoutes.adminQuoteRequests, {}, async () => {
    const snapshot = await db
      .collection(COLLECTIONS.printQuoteRequests)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return {
      requests: snapshot.docs.map((doc) => {
        const data = normalizeFirestoreData(doc.data()) as Record<string, unknown>;
        return {
          id: doc.id,
          email: (data.email as string | null | undefined) ?? null,
          country: typeof data.country === 'string' ? data.country : '',
          pieces: (data.pieces as string[] | undefined) ?? [],
          copies: Number(data.copies ?? 0),
          message: (data.message as string | null | undefined) ?? null,
          status: (data.status as 'new' | 'contacted' | 'closed' | undefined) ?? 'new',
          note: (data.note as string | null | undefined) ?? null,
          createdAt: iso(data.createdAt),
        };
      }),
    };
  });

  addRoute(app, apiRoutes.adminUpdateQuoteRequest, {}, async (request) => {
    const { id } = request.params as { id: string };
    const { status, note } = request.body as QuoteBody;
    const ref = db.collection(COLLECTIONS.printQuoteRequests).doc(id);
    const before = (await ref.get()).data();
    if (!before) throw new AppError(404, 'not_found', 'Cotización inexistente.');
    await auditedWrite(
      db,
      request.user,
      {
        action: 'quote_request.update',
        entity: COLLECTIONS.printQuoteRequests,
        entityId: id,
        before: { status: before.status ?? 'new', note: before.note ?? null },
        after: { status, note },
      },
      (batch) => batch.update(ref, { status, note, updatedAt: new Date() }),
    );
    return { id, status };
  });

  // Portada Hoy: lo que espera una acción, lo más urgente y lo más viejo primero.
  addRoute(app, apiRoutes.adminAttention, {}, async () => {
    const budget = new AiBudget(db, app.log);
    const [alerts, review, running, quotes, limits, spent] = await Promise.all([
      db.collection(COLLECTIONS.adminAlerts).where('resolvedAt', '==', null).limit(100).get(),
      db.collection(COLLECTIONS.orders).where('status', '==', 'qa_failed').limit(100).get(),
      db
        .collection(COLLECTIONS.orders)
        .where('status', 'in', ['paid', 'generating'])
        .limit(100)
        .get(),
      db.collection(COLLECTIONS.printQuoteRequests).orderBy('createdAt', 'desc').limit(50).get(),
      budget.limits(),
      budget.spentTodayUsdMicros(),
    ]);
    const items: AttentionItem[] = [];
    const alerted = new Set<string>();
    // Un aviso de falla cuyo pedido ya salió de revisión manual (se reintentó y terminó) no pide
    // nada: no se muestra aunque haya quedado abierto (los avisos viejos, de antes del cierre solo).
    const alertOrderIds = [
      ...new Set(
        alerts.docs
          .map((doc) => doc.data() as { kind?: unknown; orderId?: unknown })
          .filter((data) => data.kind === 'pipeline_failed' && typeof data.orderId === 'string')
          .map((data) => data.orderId as string),
      ),
    ];
    const settled = new Set(
      (alertOrderIds.length
        ? await db.getAll(...alertOrderIds.map((id) => db.collection(COLLECTIONS.orders).doc(id)))
        : []
      )
        .filter((snap) => snap.exists && snap.get('status') !== 'qa_failed')
        .map((snap) => snap.id),
    );
    for (const doc of alerts.docs) {
      const data = normalizeFirestoreData(doc.data()) as Record<string, unknown>;
      const kind = String(data.kind);
      const orderId = typeof data.orderId === 'string' ? data.orderId : null;
      if (orderId && kind === 'pipeline_failed' && settled.has(orderId)) continue;
      if (orderId && kind === 'pipeline_failed') alerted.add(orderId);
      items.push({
        id: `alert:${doc.id}`,
        kind: kind in ALERT_TITLES ? (kind as AttentionItem['kind']) : 'alert',
        level: kind === 'pipeline_failed' ? 'review' : 'urgent',
        title: ALERT_TITLES[kind] ?? (typeof data.message === 'string' ? data.message : kind),
        orderId,
        since: iso(data.createdAt),
        href: orderId ? `/order?id=${orderId}` : '/orders',
        resolvable: true,
      });
    }
    for (const doc of review.docs) {
      // Una falla del pipeline ya aparece como aviso (y también deja el pedido en revisión).
      if (alerted.has(doc.id)) continue;
      const data = normalizeFirestoreData(doc.data()) as Record<string, unknown>;
      items.push({
        id: `review:${doc.id}`,
        kind: 'review',
        level: 'review',
        title: 'Pedido en revisión manual',
        orderId: doc.id,
        since: iso(data.updatedAt) ?? iso(data.createdAt),
        href: '/review',
        resolvable: false,
      });
    }
    const now = Date.now();
    for (const doc of running.docs) {
      const data = normalizeFirestoreData(doc.data()) as Record<string, unknown>;
      const since = data.updatedAt instanceof Date ? data.updatedAt : null;
      if (!since || now - since.getTime() < STUCK_MS) continue;
      items.push({
        id: `stuck:${doc.id}`,
        kind: 'stuck',
        level: 'review',
        title: 'Pedido pagado que no termina de generarse',
        orderId: doc.id,
        since: since.toISOString(),
        href: `/order?id=${doc.id}`,
        resolvable: false,
      });
    }
    for (const doc of quotes.docs) {
      const data = normalizeFirestoreData(doc.data()) as Record<string, unknown>;
      if ((data.status ?? 'new') !== 'new') continue;
      items.push({
        id: `quote:${doc.id}`,
        kind: 'quote',
        level: 'notice',
        title: 'Cotización de Eventos sin responder',
        orderId: null,
        since: iso(data.createdAt),
        href: '/quotes',
        resolvable: false,
      });
    }
    const usedPercent = limits.dailyBudgetUsd
      ? Math.round((spent / 1_000_000 / limits.dailyBudgetUsd) * 100)
      : 0;
    if (usedPercent >= limits.budgetAlertPercent) {
      items.push({
        id: 'ai_budget',
        kind: 'ai_budget',
        level: usedPercent >= 100 ? 'urgent' : 'notice',
        title: `Gasto de IA de hoy al ${String(usedPercent)} % del presupuesto`,
        orderId: null,
        since: null,
        href: '/ai',
        resolvable: false,
      });
    }
    items.sort(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        (a.since ?? '9').localeCompare(b.since ?? '9'),
    );
    return { items };
  });

  addRoute(app, apiRoutes.adminResolveAlert, {}, async (request) => {
    const { id } = request.params as { id: string };
    const ref = db.collection(COLLECTIONS.adminAlerts).doc(id);
    const before = (await ref.get()).data();
    if (!before) throw new AppError(404, 'not_found', 'Aviso inexistente.');
    const resolvedAt = new Date();
    await auditedWrite(
      db,
      request.user,
      {
        action: 'admin_alert.resolve',
        entity: COLLECTIONS.adminAlerts,
        entityId: id,
        before: { resolvedAt: null },
        after: { resolvedAt: resolvedAt.toISOString() },
      },
      (batch) => batch.update(ref, { resolvedAt }),
    );
    return { id, resolvedAt: resolvedAt.toISOString() };
  });

  addRoute(app, apiRoutes.adminInsights, {}, async (request) => {
    const { days } = request.query as { days: number };
    return insights.report(days);
  });

  /**
   * Seguimiento de PayPal: solo lectura. Nuestro lado sale de los pedidos; el de PayPal, de sus
   * API de saldo, movimientos y disputas. Un error en una sección no tira las demás.
   */
  addRoute(app, apiRoutes.adminPaypal, {}, async (request) => {
    const { days } = request.query as { days: number };
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 3600 * 1000);
    const payment = providers.payment();
    const reporting = payment.id === 'paypal' ? (payment.reporting ?? null) : null;

    const snap = await db
      .collection(COLLECTIONS.orders)
      .where('payment.provider', '==', 'paypal')
      .limit(2000)
      .get();
    const orders: PaypalOrder[] = snap.docs.map((doc) => {
      const data = normalizeFirestoreData(doc.data()) as Record<string, unknown>;
      const pay = (data.payment ?? {}) as Record<string, unknown>;
      const amounts = (data.amounts ?? {}) as { totalMinor?: number };
      const num = (value: unknown) => (typeof value === 'number' ? value : null);
      return {
        orderId: doc.id,
        status: data.status as PaypalOrder['status'],
        paidAt: data.paidAt instanceof Date ? data.paidAt : null,
        totalMinor: amounts.totalMinor ?? 0,
        feeMinor: num(pay.feeMinor),
        netMinor: num(pay.netMinor),
        paymentId: typeof pay.paymentId === 'string' ? pay.paymentId : null,
      };
    });

    const live = {
      balances: null as Awaited<ReturnType<NonNullable<typeof reporting>['balances']>> | null,
      balancesError: null as string | null,
      transactions: null as Awaited<
        ReturnType<NonNullable<typeof reporting>['transactions']>
      > | null,
      transactionsError: null as string | null,
      disputes: null as ReturnType<typeof withOrderOnDispute> | null,
      disputesError: null as string | null,
    };
    if (reporting) {
      const orderByPayment = new Map(
        orders.flatMap((order) => (order.paymentId ? [[order.paymentId, order.orderId]] : [])),
      );
      const [balances, transactions, disputes] = await Promise.allSettled([
        reporting.balances(),
        (async () =>
          mergeTransactions(
            // Un tramo por vez: la API de PayPal limita el ritmo de consultas.
            await dateChunks(from, to).reduce<
              Promise<Awaited<ReturnType<typeof reporting.transactions>>[]>
            >(
              async (previous, [start, end]) => [
                ...(await previous),
                await reporting.transactions(start, end),
              ],
              Promise.resolve([]),
            ),
          ))(),
        reporting.disputes(),
      ]);
      if (balances.status === 'fulfilled') live.balances = balances.value;
      else live.balancesError = paypalReadError(balances.reason);
      if (transactions.status === 'fulfilled') live.transactions = transactions.value;
      else live.transactionsError = paypalReadError(transactions.reason);
      if (disputes.status === 'fulfilled') {
        live.disputes = withOrderOnDispute(disputes.value, orderByPayment);
      } else live.disputesError = paypalReadError(disputes.reason);
    }

    const report = buildPaypalReport({ orders, transactions: live.transactions, from, to });
    return {
      activeProvider: payment.id,
      environment: reporting?.environment ?? null,
      from: from.toISOString(),
      to: to.toISOString(),
      ours: report.ours,
      live: {
        ...live,
        transactions:
          live.transactions?.map((tx) => ({
            id: tx.id,
            kind: tx.kind,
            code: tx.code,
            status: tx.status,
            at: tx.at.toISOString(),
            currency: tx.currency,
            grossMinor: tx.grossMinor,
            feeMinor: tx.feeMinor,
            orderId: tx.orderId,
            relatedId: tx.relatedId,
          })) ?? null,
      },
      reconciliation: report.reconciliation,
    };
  });
}
