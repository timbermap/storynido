import { randomUUID } from 'node:crypto';

import {
  COLLECTIONS,
  apiRoutes,
  normalizeFirestoreData,
  toUsd,
  utcDay,
  type AdminOrderDetail,
  type AdminOrderSummary,
  type Currency,
  type OrderStatus,
} from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { DocumentSnapshot, Query } from 'firebase-admin/firestore';
import type { z } from 'zod';

import { auditedWrite } from '../admin/audit';
import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

type ListQuery = z.output<(typeof apiRoutes)['adminOrders']['query']>;
type Data = Record<string, unknown>;

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);

/** Resumen de un pedido para las listas del panel (sin datos del niño). */
export function toOrderSummary(
  doc: DocumentSnapshot,
  customerEmail: string | null,
): AdminOrderSummary {
  const data = normalizeFirestoreData(doc.data()) as Data;
  const pipeline = (data.pipeline ?? {}) as Data;
  const amounts = (data.amounts ?? {}) as { totalMinor?: number };
  const print = data.print as { provider?: string } | null | undefined;
  const routing = data.printRouting as { provider?: string } | null | undefined;
  return {
    id: doc.id,
    status: data.status as OrderStatus,
    channel: typeof data.channel === 'string' ? data.channel : 'families',
    country: typeof data.country === 'string' ? data.country : '',
    currency: typeof data.currency === 'string' ? data.currency : '',
    totalMinor: amounts.totalMinor ?? 0,
    formats: ((data.items ?? []) as { format: string }[]).map((item) => item.format),
    customerEmail,
    createdAt: iso(data.createdAt),
    failedStep: (pipeline.failedStep as string | null | undefined) ?? null,
    error: (pipeline.error as string | null | undefined) ?? null,
    printProvider: print?.provider ?? routing?.provider ?? null,
  };
}

/**
 * Operación de pedidos desde el panel (fase 15): búsqueda, detalle con costos y margen,
 * revisión manual (aprobar), reenvío de mails. Nunca muestra datos del niño (ni su nombre ni
 * sus fotos): las ilustraciones solo para revisar un pedido puntual.
 */
export function registerAdminOrderRoutes(app: FastifyInstance): void {
  const { db, pipelineEvents, notifier, metrics, providers } = app.deps;
  const orders = db.collection(COLLECTIONS.orders);

  const emails = new Map<string, Promise<string | null>>();
  /** Email del cliente (con cache por request en una misma lista). */
  async function emailOf(uid: string, cache: Map<string, Promise<string | null>> = emails) {
    let email = cache.get(uid);
    if (!email) {
      email = db
        .collection(COLLECTIONS.users)
        .doc(uid)
        .get()
        .then((doc) => (doc.get('email') as string | null | undefined) ?? null);
      cache.set(uid, email);
    }
    return email;
  }

  async function summary(
    doc: DocumentSnapshot,
    cache: Map<string, Promise<string | null>>,
  ): Promise<AdminOrderSummary> {
    return toOrderSummary(doc, await emailOf(String(doc.get('ownerUid')), cache));
  }

  async function load(orderId: string) {
    const doc = await orders.doc(orderId).get();
    if (!doc.exists) throw new AppError(404, 'not_found', 'Pedido inexistente.');
    return doc;
  }

  addRoute(app, apiRoutes.adminOrders, {}, async (request) => {
    const query = request.query as ListQuery;
    const cache = new Map<string, Promise<string | null>>();
    // Número de pedido exacto.
    if (query.q && !query.q.includes('@')) {
      const doc = await orders.doc(query.q.trim()).get();
      return { orders: doc.exists ? [await summary(doc, cache)] : [] };
    }
    // Un filtro de igualdad en Firestore (con su índice por fecha); el resto, en memoria.
    let ref: Query = orders;
    if (query.q) {
      const users = await db
        .collection(COLLECTIONS.users)
        .where('email', '==', query.q.trim().toLowerCase())
        .limit(1)
        .get();
      const uid = users.docs[0]?.id;
      if (!uid) return { orders: [] };
      ref = ref.where('ownerUid', '==', uid);
    } else if (query.status) {
      ref = ref.where('status', '==', query.status);
    } else if (query.country) {
      ref = ref.where('country', '==', query.country);
    }
    if (query.from) ref = ref.where('createdAt', '>=', new Date(query.from));
    if (query.to) ref = ref.where('createdAt', '<', new Date(query.to));
    if (query.before) ref = ref.where('createdAt', '<', new Date(query.before));
    const snapshot = await ref.orderBy('createdAt', 'desc').limit(200).get();
    const list = await Promise.all(snapshot.docs.map((doc) => summary(doc, cache)));
    return {
      orders: list
        .filter((order) => !query.status || order.status === query.status)
        .filter((order) => !query.country || order.country === query.country)
        .filter((order) => !query.channel || order.channel === query.channel)
        .filter((order) => !query.format || order.formats.includes(query.format))
        .slice(0, query.limit),
    };
  });

  addRoute(app, apiRoutes.adminOrderDetail, {}, async (request): Promise<AdminOrderDetail> => {
    const { orderId } = request.params as { orderId: string };
    const doc = await load(orderId);
    const data = normalizeFirestoreData(doc.data()) as Data;
    const base = await summary(doc, new Map());
    const amounts = {
      subtotalMinor: 0,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
      ...(data.amounts as Data | undefined),
    };
    const snapshot = data.priceSnapshot as {
      discount?: { reason?: string; label?: string };
    } | null;
    const address = data.shippingAddress as Data | null | undefined;
    const routing = data.printRouting as
      | {
          totalCostUsdMinor?: number;
          quotes?: { provider: string; totalCostUsdMinor: number | null; error: string | null }[];
        }
      | null
      | undefined;
    const print = data.print as AdminOrderDetail['print'] | undefined;
    const costs = (data.costsUsdMicros ?? {}) as { ai?: number };
    const fx = await metrics.fx(utcDay());
    const currency = String(data.currency) as Currency;
    const revenueUsd = toUsd(amounts.totalMinor, currency, fx);
    const taxUsd = toUsd(amounts.taxMinor, currency, fx);
    const aiUsd = (costs.ai ?? 0) / 1_000_000;
    const printUsd = (routing?.totalCostUsdMinor ?? 0) / 100;
    const round = (value: number) => Math.round(value * 100) / 100;

    const bookId = String(data.bookId);
    const qa = await db
      .collection(COLLECTIONS.books)
      .doc(bookId)
      .collection(COLLECTIONS.qaEvents)
      .orderBy('at', 'desc')
      .limit(50)
      .get();
    let pages: AdminOrderDetail['pages'] = [];
    // Las ilustraciones muestran al chico: solo para revisar un pedido en revisión manual.
    if (base.status === 'qa_failed') {
      // Una tarea por página (generación vigente): también las buenas cuando otra página falló.
      const generation = Number(doc.get('pipeline.generation') ?? 0);
      const tasks = await orders
        .doc(orderId)
        .collection(COLLECTIONS.orderSteps)
        .doc('generate_illustrations')
        .collection(COLLECTIONS.illustrationTasks)
        .where('generation', '==', generation)
        .get();
      const book = (doc.get('snapshot') ?? {}) as {
        title?: string;
        pages?: { text?: string }[];
      };
      const storage = providers.storage();
      pages = await Promise.all(
        tasks.docs.map(async (task) => {
          const imagePath = task.get('imagePath') as string | null;
          const done = task.get('status') === 'succeeded' && imagePath;
          const index = Number(task.get('index'));
          return {
            index,
            text: (index === 0 ? book.title : book.pages?.[index - 1]?.text) ?? null,
            url: done
              ? (await storage.signedDownloadUrl({ bucket: 'assets', path: imagePath }, 900)).url
              : null,
            error: done
              ? null
              : task.get('status') === 'failed'
                ? String(task.get('error') ?? 'Sin ilustrar')
                : 'No llegó a pintarse (el pedido se detuvo antes de terminarla).',
          };
        }),
      );
    }
    // PDF de revisión (si el admin lo pidió para esta generación): enlace corto, igual que las páginas.
    const review = doc.get('reviewPreview') as
      { path: string; missing?: number[]; overflow?: string[]; at?: unknown } | undefined;
    const previewBook =
      base.status === 'qa_failed' || base.status === 'ready'
        ? review
          ? {
              url: (
                await providers
                  .storage()
                  .signedDownloadUrl({ bucket: 'pdfs', path: review.path }, 900)
              ).url,
              missing: review.missing ?? [],
              overflow: review.overflow ?? [],
              at: iso(normalizeFirestoreData(review.at)),
            }
          : null
        : null;
    // Fotos del chico y su personaje aprobado: solo para revisar un pedido en revisión manual.
    let reference: AdminOrderDetail['reference'] = null;
    if (base.status === 'qa_failed') {
      const storage = providers.storage();
      const book = (await db.collection(COLLECTIONS.books).doc(bookId).get()).data();
      const childId = typeof book?.childId === 'string' ? book.childId : null;
      const photoDocs = childId
        ? await db
            .collection(COLLECTIONS.photos)
            .where('ownerUid', '==', String(data.ownerUid))
            .where('childId', '==', childId)
            .get()
        : null;
      const photos = await Promise.all(
        (photoDocs?.docs ?? []).flatMap((photo) => {
          const path = photo.get('storagePath') as string | undefined;
          return path
            ? [storage.signedDownloadUrl({ bucket: 'photos', path }, 900).then((link) => link.url)]
            : [];
        }),
      );
      const sheetPath =
        (doc.get('snapshot.character.sheetPath') as string | undefined) ??
        (book?.preview as { character?: { previewImagePath?: string } } | undefined)?.character
          ?.previewImagePath;
      reference = {
        photos,
        character: sheetPath
          ? (await storage.signedDownloadUrl({ bucket: 'assets', path: sheetPath }, 900)).url
          : null,
      };
    }
    return {
      ...base,
      previewBook,
      reference,
      bookId,
      bookTitle: typeof data.bookTitle === 'string' ? data.bookTitle : null,
      ownerUid: String(data.ownerUid),
      items: ((data.items ?? []) as { piece?: string; format: string; quantity: number }[]).map(
        (item) => ({
          piece: item.piece ?? 'book',
          format: item.format,
          quantity: item.quantity,
        }),
      ),
      amounts,
      discount: {
        reason: snapshot?.discount?.reason ?? null,
        label: snapshot?.discount?.label ?? null,
      },
      shipping: address
        ? {
            name: String(address.name),
            city: String(address.city),
            state: (address.state as string | null | undefined) ?? null,
            postalCode: String(address.postalCode),
            country: String(address.country),
            hasPhone: typeof address.phone === 'string' && address.phone.trim().length > 0,
          }
        : null,
      payment: {
        provider: (() => {
          const provider = (data.payment as Data | undefined)?.provider;
          return typeof provider === 'string' ? provider : '';
        })(),
        paymentId: ((data.payment as Data | undefined)?.paymentId as string | null) ?? null,
      },
      print: print ?? null,
      printQuotes: (routing?.quotes ?? []).map((quote) => ({
        provider: quote.provider,
        totalCostUsdMinor: quote.totalCostUsdMinor,
        error: quote.error,
      })),
      costs: {
        revenueUsd: round(revenueUsd),
        taxUsd: round(taxUsd),
        aiUsd: round(aiUsd),
        printUsd: round(printUsd),
        marginUsd: round(revenueUsd - taxUsd - aiUsd - printUsd),
        fxDate: fx.date,
      },
      qa: qa.docs.map((event) => ({
        code: String(event.get('code')),
        at: iso(normalizeFirestoreData(event.get('at'))),
      })),
      pages: pages.sort((a, b) => a.index - b.index),
    };
  });

  // Un pedido que la imprenta rechazó por un dato de contacto que faltaba (el teléfono): se completa
  // acá y se reintenta la entrega. Solo en revisión o listo (antes de enviarlo), y queda auditado
  // sin guardar el número en la auditoría.
  addRoute(app, apiRoutes.adminSetShippingContact, {}, async (request) => {
    const { orderId } = request.params as { orderId: string };
    const { phone, taxId } = request.body as { phone: string; taxId?: string | null };
    const doc = await load(orderId);
    const status = doc.get('status') as OrderStatus;
    if (status !== 'qa_failed' && status !== 'ready') {
      throw new AppError(409, 'bad_request', `El pedido está en "${status}".`);
    }
    if (!doc.get('shippingAddress')) {
      throw new AppError(409, 'bad_request', 'El pedido no tiene dirección de envío.');
    }
    const before = (doc.get('shippingAddress.phone') as string | null | undefined) ?? null;
    await auditedWrite(
      db,
      request.user,
      {
        action: 'order.set_shipping_contact',
        entity: COLLECTIONS.orders,
        entityId: orderId,
        before: { phoneSet: Boolean(before?.trim()) },
        after: { phoneSet: true, taxIdChanged: taxId !== undefined },
      },
      (batch) => {
        batch.update(orders.doc(orderId), {
          'shippingAddress.phone': phone,
          ...(taxId !== undefined ? { 'shippingAddress.taxId': taxId } : {}),
          updatedAt: new Date(),
        });
      },
    );
    return { accepted: true as const };
  });

  addRoute(app, apiRoutes.adminApproveOrder, {}, async (request) => {
    const { orderId } = request.params as { orderId: string };
    const doc = await load(orderId);
    const status = doc.get('status') as OrderStatus;
    const failedStep = doc.get('pipeline.failedStep') as string | null | undefined;
    if (status !== 'qa_failed' || failedStep !== 'quality_check') {
      throw new AppError(
        409,
        'bad_request',
        'Solo se aprueba un pedido que falló el control de calidad (si falló otro paso, reintenta o regenera).',
      );
    }
    const generation = Number(doc.get('pipeline.generation') ?? 0);
    const requestId = randomUUID();
    const by = request.user?.email ?? request.user?.uid ?? null;
    await auditedWrite(
      db,
      request.user,
      {
        action: 'order.approve',
        entity: COLLECTIONS.orders,
        entityId: orderId,
        before: { status, failedStep },
        after: { approvedGeneration: generation, requestId },
      },
      (batch) => {
        batch.update(orders.doc(orderId), { 'pipeline.humanApproval': { generation, by } });
      },
    );
    await pipelineEvents.publish({
      type: 'order.retry_step',
      fromStep: 'quality_check',
      orderId,
      requestId,
    });
    return { accepted: true as const, requestId };
  });

  addRoute(app, apiRoutes.adminResendEmail, {}, async (request) => {
    const { orderId } = request.params as { orderId: string };
    const doc = await load(orderId);
    const status = doc.get('status') as OrderStatus;
    const requestId = randomUUID();
    const outcome = await notifier.orderStatus(orderId, status, { resend: requestId });
    const sent = outcome === 'sent';
    await auditedWrite(
      db,
      request.user,
      {
        action: 'order.resend_email',
        entity: COLLECTIONS.orders,
        entityId: orderId,
        before: { status },
        after: { requestId, sent },
      },
      () => undefined,
    );
    return {
      sent,
      detail: outcome
        ? `Mail del estado "${status}": ${outcome}.`
        : `El estado "${status}" no tiene mail.`,
    };
  });

  addRoute(app, apiRoutes.adminReviewQueue, {}, async () => {
    const snapshot = await orders
      .where('status', '==', 'qa_failed')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const cache = new Map<string, Promise<string | null>>();
    return {
      orders: await Promise.all(
        snapshot.docs.map(async (doc) => {
          const qa = await db
            .collection(COLLECTIONS.books)
            .doc(String(doc.get('bookId')))
            .collection(COLLECTIONS.qaEvents)
            .orderBy('at', 'desc')
            .limit(20)
            .get();
          return {
            ...(await summary(doc, cache)),
            qaCodes: [...new Set(qa.docs.map((event) => String(event.get('code'))))],
          };
        }),
      ),
    };
  });
}
