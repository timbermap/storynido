import {
  isSimulatedPrinter,
  mockPrintWebhookSequence,
  signMockPrintWebhook,
  type ProviderRegistry,
} from '@storynido/providers';
import {
  COLLECTIONS,
  WebhookSignatureError,
  canTransitionOrder,
  type AuditLogEntry,
  type OrderStatus,
  type PrintEvent,
  type PrintStatus,
} from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import { AppError } from '../errors';

interface OrderDoc {
  ownerUid: string;
  status: OrderStatus;
  print: {
    provider: string;
    externalOrderId: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
}

/** Estado de la imprenta → estado del pedido. */
const STATUS_FROM_PRINT: Record<PrintStatus, OrderStatus> = {
  in_production: 'in_production',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  // Una falla de la imprenta vuelve a revisión manual (se reimprime con el mismo libro).
  failed: 'qa_failed',
};

/** Con el libro listo (o después) se puede descargar el digital. */
const DOWNLOADABLE = new Set<OrderStatus>([
  'ready',
  'sent_to_print',
  'in_production',
  'shipped',
  'delivered',
]);

/**
 * Lo que pasa después de generar el libro: la imprenta (webhooks firmados e idempotentes,
 * cancelación) y la descarga del digital con una URL firmada de corta duración.
 */
export class FulfillmentService {
  constructor(
    private readonly db: Firestore,
    private readonly providers: ProviderRegistry,
    private readonly log: FastifyBaseLogger,
    private readonly options: { devToolsEnabled: boolean; mockWebhookSecret: string },
  ) {}

  async handlePrintWebhook(
    providerId: string,
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<'processed' | 'duplicate' | 'ignored'> {
    const printer = this.providers.printer(providerId);
    if (!printer) throw new AppError(404, 'not_found', 'Imprenta desconocida.');
    let event: PrintEvent;
    try {
      event = printer.parseWebhook({ rawBody, headers });
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw new AppError(400, 'bad_request', 'Firma inválida.');
      }
      throw error;
    }
    const eventRef = this.db.collection('printEvents').doc(`${providerId}_${event.eventId}`);
    if ((await eventRef.get()).exists) return 'duplicate';
    const outcome = event.type === 'status' ? await this.applyStatus(providerId, event) : 'ignored';
    await eventRef.set({ type: event.type, outcome, at: new Date() });
    return outcome;
  }

  private async applyStatus(providerId: string, event: Extract<PrintEvent, { type: 'status' }>) {
    const ref = this.db.collection(COLLECTIONS.orders).doc(event.orderId);
    const to = STATUS_FROM_PRINT[event.status];
    const outcome = await this.db.runTransaction(async (tx) => {
      const order = (await tx.get(ref)).data() as OrderDoc | undefined;
      // El evento tiene que venir de la imprenta que tiene el pedido.
      if (
        order?.print?.externalOrderId !== event.externalOrderId ||
        order.print.provider !== providerId
      ) {
        return 'ignored' as const;
      }
      if (!canTransitionOrder(order.status, to)) return 'ignored' as const;
      tx.update(ref, {
        status: to,
        ...(event.trackingNumber ? { 'print.trackingNumber': event.trackingNumber } : {}),
        ...(event.trackingUrl ? { 'print.trackingUrl': event.trackingUrl } : {}),
        updatedAt: new Date(),
      });
      return 'processed' as const;
    });
    if (outcome === 'processed' && event.status === 'failed') {
      await this.db.collection(COLLECTIONS.adminAlerts).add({
        kind: 'print_failed',
        orderId: event.orderId,
        step: null,
        message: 'La imprenta informó una falla: hay que reimprimir con el mismo libro.',
        createdAt: new Date(),
        resolvedAt: null,
      });
      this.log.error({ orderId: event.orderId }, 'print failed');
    }
    return outcome;
  }

  /** Cancela en la imprenta si todavía se puede (lo decide la imprenta). */
  async cancelPrint(actor: { uid: string; email: string | null }, orderId: string) {
    const ref = this.db.collection(COLLECTIONS.orders).doc(orderId);
    const order = (await ref.get()).data() as OrderDoc | undefined;
    if (!order?.print?.externalOrderId) {
      throw new AppError(409, 'bad_request', 'El pedido no está en la imprenta.');
    }
    if (!canTransitionOrder(order.status, 'cancelled')) {
      throw new AppError(409, 'bad_request', `Ya no se puede cancelar ("${order.status}").`);
    }
    const printer = this.providers.printer(order.print.provider);
    if (!printer) {
      throw new AppError(
        409,
        'bad_request',
        `La imprenta "${order.print.provider}" no está activa.`,
      );
    }
    const result = await printer.cancelOrder(order.print.externalOrderId);
    const audit: AuditLogEntry = {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: 'order.cancel_print',
      entity: COLLECTIONS.orders,
      entityId: orderId,
      before: { status: order.status },
      after: { cancelled: result.cancelled, reason: result.reason },
      at: new Date(),
    };
    await this.db.collection(COLLECTIONS.auditLog).add(audit);
    if (!result.cancelled) {
      throw new AppError(409, 'bad_request', result.reason ?? 'La imprenta no pudo cancelar.');
    }
    await ref.update({ status: 'cancelled', updatedAt: new Date() });
    return { status: 'cancelled' as const };
  }

  /** URL firmada de 15 minutos al PDF digital, generada al momento. */
  async download(uid: string, orderId: string) {
    const ref = this.db.collection(COLLECTIONS.orders).doc(orderId);
    const order = (await ref.get()).data() as OrderDoc | undefined;
    if (order?.ownerUid !== uid) throw new AppError(404, 'not_found', 'Pedido inexistente.');
    if (!DOWNLOADABLE.has(order.status)) {
      throw new AppError(409, 'bad_request', 'El libro todavía no está listo.');
    }
    const deliver = (await ref.collection(COLLECTIONS.orderSteps).doc('deliver').get()).data() as
      { output?: { digitalPath?: string } } | undefined;
    const path = deliver?.output?.digitalPath;
    if (!path) throw new AppError(409, 'bad_request', 'El libro todavía no está listo.');
    const signed = await this.providers
      .storage()
      .signedDownloadUrl({ bucket: 'pdfs', path }, 15 * 60, 'storynido.pdf');
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  /** Imprenta simulada: avanza un paso (en producción → enviado → entregado) por llamada. */
  async simulatePrint(uid: string, orderId: string) {
    const ref = this.db.collection(COLLECTIONS.orders).doc(orderId);
    const order = (await ref.get()).data() as OrderDoc | undefined;
    if (order?.ownerUid !== uid) throw new AppError(404, 'not_found', 'Pedido inexistente.');
    if (!order.print?.externalOrderId) {
      throw new AppError(409, 'bad_request', 'El pedido no está en la imprenta.');
    }
    if (!this.options.devToolsEnabled || !isSimulatedPrinter(order.print.provider)) {
      throw new AppError(409, 'bad_request', 'La imprenta no es simulada.');
    }
    const next = mockPrintWebhookSequence(orderId, order.print.externalOrderId).find((event) =>
      canTransitionOrder(order.status, STATUS_FROM_PRINT[event.data.status]),
    );
    if (!next) throw new AppError(409, 'bad_request', 'No hay más pasos de imprenta.');
    const webhook = signMockPrintWebhook(this.options.mockWebhookSecret, next);
    await this.handlePrintWebhook(order.print.provider, webhook.rawBody, webhook.headers);
    return { status: ((await ref.get()).data() as OrderDoc).status };
  }
}
