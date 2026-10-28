import { COLLECTIONS, apiRoutes, normalizeFirestoreData } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { auditedWrite } from '../admin/audit';
import { AppError } from '../errors';
import { InsightsService } from '../metrics/insights';
import { addRoute } from '../plugins/route';

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

  addRoute(app, apiRoutes.adminInsights, {}, async (request) => {
    const { days } = request.query as { days: number };
    return insights.report(days);
  });
}
