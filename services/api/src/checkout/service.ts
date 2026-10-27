import type { ProviderRegistry } from '@storynido/providers';
import { isSimulatedPrinter, signMockPaymentWebhook } from '@storynido/providers';
import {
  COLLECTIONS,
  WebhookSignatureError,
  addressProblems,
  assertOrderTransition,
  canTransitionOrder,
  printCandidates,
  rankPrintQuotes,
  type checkoutQuoteBodySchema,
  type createCheckoutBodySchema,
  quote,
  type AuditLogEntry,
  type BookFormat,
  type BookLength,
  type Coupon,
  type Locale,
  type OrderStatus,
  type PaymentEvent,
  type PriceSnapshot,
  type PrintRouting,
  type Promotion,
  type PublicOrder,
} from '@storynido/shared';
import { previewFingerprint } from '@storynido/shared/server';
import type { FastifyBaseLogger } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { z } from 'zod';

import type { CatalogRepository } from '../catalog';
import { AppError } from '../errors';
import type { PipelineEventPublisher } from '../orders/events';
import type { PreviewService } from '../preview/service';
import type { ConversionReporter } from './conversions';

type QuoteBody = z.output<typeof checkoutQuoteBodySchema>;
type PriceBody = Omit<QuoteBody, 'sourceOrderId'>;
type CheckoutBody = z.output<typeof createCheckoutBodySchema>;

/** Una imprenta que tarda más que esto en cotizar queda afuera (las otras siguen). */
const PRINT_QUOTE_TIMEOUT_MS = 8000;

const printUnavailable = () =>
  new AppError(
    409,
    'print_unavailable',
    'Disponible en digital; la impresión todavía no está disponible para este libro o destino.',
  );

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Sin respuesta en ${String(ms)} ms`));
      }, ms);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}

/** Rutas de la web por idioma a las que vuelve el pago. */
const ORDER_PATH: Record<Locale, string> = { es: 'pedido', en: 'order', pt: 'pedido' };
const CREATE_PATH: Record<Locale, string> = { es: 'crear', en: 'create', pt: 'criar' };

interface OrderDoc {
  ownerUid: string;
  bookId: string;
  status: OrderStatus;
  items: { format: BookFormat; quantity: number }[];
  priceSnapshot: PriceSnapshot | null;
  couponCode: string | null;
  analyticsConsent?: boolean;
  payment: { provider: string; checkoutSessionId: string | null; paymentId: string | null };
  print?: {
    provider: string;
    externalOrderId: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
  createdAt: unknown;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Checkout y pagos. El precio se calcula siempre acá; el pedido congela el precio (cada
 * componente) y la huella de lo aprobado. El pago se confirma solo por el webhook firmado.
 */
export class CheckoutService {
  constructor(
    private readonly db: Firestore,
    private readonly providers: ProviderRegistry,
    private readonly catalog: CatalogRepository,
    private readonly previews: PreviewService,
    private readonly events: PipelineEventPublisher,
    private readonly conversions: ConversionReporter,
    private readonly log: FastifyBaseLogger,
    private readonly options: { devToolsEnabled: boolean; mockWebhookSecret: string },
  ) {}

  // ------------------------------------------------------------------ precio

  async quote(uid: string, body: QuoteBody) {
    const { result } = body.sourceOrderId
      ? await this.reorderSource(uid, body.sourceOrderId, body.format).then(async (source) => ({
          result: await this.price(source.book, body, source.pages),
        }))
      : await this.prepare(uid, body);
    return { snapshot: result.snapshot, couponError: result.couponError };
  }

  /** El libro tiene que estar aprobado y vigente; el precio sale del catálogo del país. */
  private async prepare(uid: string, body: PriceBody) {
    const ref = this.db.collection(COLLECTIONS.books).doc(body.bookId);
    const book = (await ref.get()).data();
    if (book?.ownerUid !== uid) throw new AppError(404, 'not_found', 'Libro inexistente.');
    const preview = await this.previews.get(uid, body.bookId);
    if (
      book.status !== 'preview_ready' ||
      preview.preview?.stage !== 'complete' ||
      !preview.preview.character?.approved
    ) {
      throw new AppError(409, 'bad_request', 'Primero aprueba al personaje y la muestra.');
    }
    if (preview.preview.stale) {
      throw new AppError(409, 'bad_request', 'Cambiaste tus elecciones: crea la muestra de nuevo.');
    }
    const pages = (book.preview as { interiorPages?: number } | null)?.interiorPages ?? 0;
    const result = await this.price(book, body, pages);
    return {
      book,
      preview: book.preview as Parameters<typeof previewFingerprint>[0],
      result,
      pages,
    };
  }

  /** Precio e imprenta (formato habilitado, páginas y cantidad) para un libro ya validado. */
  private async price(book: Record<string, unknown>, body: PriceBody, pages: number) {
    // Nunca se manda a imprenta algo incompatible: alguna imprenta activa tiene que poder.
    if (body.format !== 'digital' && (await this.printCandidates(body, pages)).length === 0) {
      throw printUnavailable();
    }
    const [countries, prices, coupon, promotions] = await Promise.all([
      this.catalog.countries(),
      this.catalog.prices(body.country),
      body.couponCode ? this.coupon(body.couponCode) : Promise.resolve(null),
      this.promotions(),
    ]);
    const result = quote({
      country: countries.find((country) => country.code === body.country) ?? null,
      price: prices.find((price) => price.format === body.format) ?? null,
      format: body.format,
      length: (book.length as BookLength | null | undefined) ?? null,
      quantity: body.quantity,
      coupon,
      couponCode: body.couponCode,
      promotions,
      now: new Date(),
    });
    if (!result.ok) throw new AppError(409, 'bad_request', `No disponible: ${result.error}`);
    return result;
  }

  private async printCandidates(body: PriceBody, pages: number) {
    return printCandidates(
      await this.catalog.printOptions(body.country),
      [{ format: body.format, pages, quantity: body.quantity }],
      this.providers.printers().map((printer) => printer.id),
    );
  }

  /**
   * Elige la imprenta: cotiza con todas las que pueden (ya con la dirección) y gana la más
   * barata en impresión + envío; si empatan, la que llega antes. El precio al cliente no cambia:
   * sale siempre del catálogo. La elección queda congelada en el pedido.
   */
  private async routePrint(body: CheckoutBody, pages: number): Promise<PrintRouting | null> {
    if (body.format === 'digital' || !body.shippingAddress) return null;
    const address = body.shippingAddress;
    const candidates = await this.printCandidates(body, pages);
    const results = await Promise.all(
      candidates.map(async (provider) => {
        try {
          const printer = this.providers.printer(provider);
          if (!printer) throw new Error('Imprenta inactiva');
          const quoted = await withTimeout(
            printer.quote(
              [
                {
                  format: body.format as 'softcover' | 'hardcover',
                  pageCount: pages,
                  quantity: body.quantity,
                },
              ],
              address,
              'USD',
            ),
            PRINT_QUOTE_TIMEOUT_MS,
          );
          return { provider, ok: true as const, ...quoted };
        } catch (error) {
          this.log.warn({ provider, err: error }, 'print quote failed');
          return {
            provider,
            ok: false as const,
            error: error instanceof Error ? error.message.slice(0, 200) : 'error',
          };
        }
      }),
    );
    const ranked = rankPrintQuotes(results.flatMap((result) => (result.ok ? [result] : [])));
    const best = ranked[0];
    if (!best) throw printUnavailable();
    return {
      provider: best.provider,
      totalCostUsdMinor: best.totalCostUsdMinor,
      etaDaysMin: best.etaDaysMin,
      etaDaysMax: best.etaDaysMax,
      quotes: [
        ...ranked.map((quoted) => ({
          provider: quoted.provider,
          totalCostUsdMinor: quoted.totalCostUsdMinor,
          etaDaysMax: quoted.etaDaysMax,
          error: null,
        })),
        ...results.flatMap((result) =>
          result.ok
            ? []
            : [
                {
                  provider: result.provider,
                  totalCostUsdMinor: null,
                  etaDaysMax: null,
                  error: result.error,
                },
              ],
        ),
      ],
      quotedAt: new Date(),
    };
  }

  private async coupon(code: string): Promise<Coupon | null> {
    const data = (await this.db.collection(COLLECTIONS.coupons).doc(code).get()).data();
    return data
      ? ({
          ...data,
          ...dates(data, ['validFrom', 'validUntil', 'createdAt', 'updatedAt']),
        } as Coupon)
      : null;
  }

  private async promotions(): Promise<Promotion[]> {
    const snap = await this.db.collection(COLLECTIONS.promotions).where('active', '==', true).get();
    return snap.docs.map(
      (doc) =>
        ({
          ...doc.data(),
          ...dates(doc.data(), ['startsAt', 'endsAt', 'createdAt', 'updatedAt']),
        }) as Promotion,
    );
  }

  // ------------------------------------------------------------------ checkout

  async create(
    user: { uid: string; email: string | null; anonymous: boolean },
    body: CheckoutBody,
    origin: string,
  ): Promise<{ orderId: string; checkoutUrl: string }> {
    if (user.anonymous) {
      throw new AppError(403, 'account_required', 'Crea tu cuenta para comprar.');
    }
    const { book, preview, result, pages } = await this.prepare(user.uid, body);
    this.checkAddress(body);
    const printRouting = await this.routePrint(body, pages);
    return this.open(user, origin, {
      bookId: body.bookId,
      book,
      body,
      price: result.snapshot,
      title: preview.title,
      fields: {
        approval: { fingerprint: previewFingerprint(preview), approvedAt: new Date() },
        printRouting,
      },
    });
  }

  /**
   * Recompra con un clic: el mismo libro (ya generado) en otro formato o como regalo. Copia el
   * libro congelado del pedido original: el pipeline no vuelve a llamar a la IA.
   */
  async reorder(
    user: { uid: string; email: string | null; anonymous: boolean },
    sourceOrderId: string,
    body: Omit<CheckoutBody, 'bookId'>,
    origin: string,
  ): Promise<{ orderId: string; checkoutUrl: string }> {
    if (user.anonymous) {
      throw new AppError(403, 'account_required', 'Crea tu cuenta para comprar.');
    }
    const { source, book, bookId, pages } = await this.reorderSource(
      user.uid,
      sourceOrderId,
      body.format,
    );
    const full = { ...body, bookId };
    const price = await this.price(book, full, pages);
    this.checkAddress(full);
    const printRouting = await this.routePrint(full, pages);
    const snapshot = source.snapshot as { title?: string };
    return this.open(user, origin, {
      bookId,
      book,
      body: full,
      price: price.snapshot,
      title: snapshot.title ?? 'StoryNido',
      fields: {
        sourceOrderId,
        printRouting,
        snapshot: source.snapshot,
        snapshotHash: source.snapshotHash ?? null,
        approval: source.approval ?? null,
      },
    });
  }

  /** Pedido original de una recompra: propio, terminado y con resolución para el formato. */
  private async reorderSource(uid: string, sourceOrderId: string, format: BookFormat) {
    const sourceRef = this.db.collection(COLLECTIONS.orders).doc(sourceOrderId);
    const source = (await sourceRef.get()).data();
    if (source?.ownerUid !== uid) throw new AppError(404, 'not_found', 'Pedido inexistente.');
    const generated = ['ready', 'sent_to_print', 'in_production', 'shipped', 'delivered'];
    if (!generated.includes(String(source.status)) || !source.snapshot) {
      throw new AppError(409, 'bad_request', 'Ese libro todavía no está terminado.');
    }
    const sourceItems = (source.items ?? []) as { format: BookFormat }[];
    // Las ilustraciones de un libro digital son de pantalla (1K): no alcanzan para imprimir.
    if (format !== 'digital' && sourceItems.every((item) => item.format === 'digital')) {
      throw new AppError(
        409,
        'print_unavailable',
        'Este libro se creó en digital: para imprimirlo hace falta crearlo en alta resolución.',
      );
    }
    const layout = (
      await sourceRef.collection(COLLECTIONS.orderSteps).doc('layout_pdf').get()
    ).data() as { output?: { files?: { format: string; pages: number }[] } } | undefined;
    const digital = layout?.output?.files?.find((file) => file.format === 'digital');
    const bookId = String(source.bookId);
    const book = (await this.db.collection(COLLECTIONS.books).doc(bookId).get()).data() ?? {};
    return { source, book, bookId, pages: digital ? digital.pages - 2 : 0 };
  }

  private checkAddress(body: CheckoutBody) {
    if (body.format === 'digital') return;
    if (!body.shippingAddress)
      throw new AppError(400, 'bad_request', 'Falta la dirección de envío.');
    if (body.shippingAddress.country !== body.country) {
      throw new AppError(400, 'bad_request', 'La dirección tiene que ser del país elegido.');
    }
    const problems = addressProblems(body.shippingAddress);
    if (problems.length > 0) {
      throw new AppError(400, 'validation_failed', `Revisa la dirección: ${problems.join(', ')}.`);
    }
  }

  /** Abre el pedido (pendiente de pago, con el precio congelado) y la sesión de pago. */
  private async open(
    user: { uid: string; email: string | null },
    origin: string,
    input: {
      bookId: string;
      book: Record<string, unknown>;
      body: CheckoutBody;
      price: PriceSnapshot;
      title: string;
      fields: Record<string, unknown>;
    },
  ): Promise<{ orderId: string; checkoutUrl: string }> {
    const { book, body, price } = input;
    const locale = (book.language as Locale | undefined) ?? 'es';
    const ref = this.db.collection(COLLECTIONS.orders).doc();
    const now = new Date();
    await ref.set({
      ownerUid: user.uid,
      bookId: input.bookId,
      bookTitle: input.title,
      status: 'pending_payment',
      channel: typeof book.channel === 'string' ? book.channel : 'families',
      items: [{ piece: 'book', format: body.format, quantity: body.quantity }],
      country: body.country,
      currency: price.currency,
      amounts: {
        subtotalMinor: price.subtotalMinor,
        discountMinor: price.discount.minor,
        shippingMinor: price.shipping.minor,
        taxMinor: price.tax.minor,
        totalMinor: price.totalMinor,
      },
      priceSnapshot: price,
      couponCode: price.discount.reason === 'coupon' ? price.discount.label : null,
      gift: body.gift,
      shippingAddress: body.format === 'digital' ? null : body.shippingAddress,
      analyticsConsent: body.analyticsConsent,
      payment: { provider: this.providers.payment().id, checkoutSessionId: null, paymentId: null },
      print: null,
      costsUsdMicros: { ai: 0, print: 0, shipping: 0 },
      pipeline: {
        generation: 0,
        runId: null,
        startedAt: null,
        finishedAt: null,
        failedStep: null,
        error: null,
      },
      ...input.fields,
      createdAt: now,
      updatedAt: now,
    });

    const session = await this.providers.payment().createCheckout({
      orderId: ref.id,
      customerEmail: user.email,
      currency: price.currency,
      locale,
      // Un solo ítem con el total calculado acá: el proveedor nunca recalcula el precio.
      lineItems: [{ name: input.title, amountMinor: price.totalMinor, quantity: 1 }],
      successUrl: `${origin}/${locale}/${ORDER_PATH[locale]}/${ref.id}`,
      cancelUrl: `${origin}/${locale}/${CREATE_PATH[locale]}/${input.bookId}`,
    });
    await ref.update({ 'payment.checkoutSessionId': session.id, updatedAt: new Date() });
    return { orderId: ref.id, checkoutUrl: session.url };
  }

  async order(uid: string, orderId: string): Promise<PublicOrder> {
    const snap = await this.db.collection(COLLECTIONS.orders).doc(orderId).get();
    const order = snap.data() as OrderDoc | undefined;
    if (order?.ownerUid !== uid) throw new AppError(404, 'not_found', 'Pedido inexistente.');
    return {
      orderId,
      bookId: order.bookId,
      status: order.status,
      items: order.items.map((item) => ({ format: item.format, quantity: item.quantity })),
      priceSnapshot: order.priceSnapshot,
      createdAt: toIso(order.createdAt),
      canSimulatePayment:
        this.options.devToolsEnabled &&
        order.status === 'pending_payment' &&
        this.providers.payment().id === 'mock',
      canSimulatePrint:
        this.options.devToolsEnabled &&
        isSimulatedPrinter(order.print?.provider ?? '') &&
        Boolean(order.print?.externalOrderId) &&
        ['sent_to_print', 'in_production', 'shipped'].includes(order.status),
      canDownload: ['ready', 'sent_to_print', 'in_production', 'shipped', 'delivered'].includes(
        order.status,
      ),
      tracking: order.print?.trackingNumber
        ? { number: order.print.trackingNumber, url: order.print.trackingUrl }
        : null,
    };
  }

  // ------------------------------------------------------------------ webhook

  /**
   * Webhook del proveedor: firma verificada y procesamiento idempotente por ID de evento.
   * Devuelve qué pasó; el route responde 200 salvo firma inválida (400).
   */
  async handleWebhook(
    providerId: string,
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<'processed' | 'duplicate' | 'ignored'> {
    const provider = this.providers.payment();
    if (provider.id !== providerId) throw new AppError(404, 'not_found', 'Proveedor desconocido.');
    let event: PaymentEvent;
    try {
      event = provider.parseWebhook({ rawBody, headers });
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw new AppError(400, 'bad_request', 'Firma inválida.');
      }
      throw error;
    }
    const eventRef = this.db.collection('paymentEvents').doc(`${providerId}_${event.eventId}`);
    if ((await eventRef.get()).exists) return 'duplicate';

    const outcome = await this.apply(event);
    await eventRef.set({ type: event.type, outcome, at: new Date() });
    return outcome;
  }

  private async apply(event: PaymentEvent): Promise<'processed' | 'ignored'> {
    switch (event.type) {
      case 'checkout.completed':
        return this.paid(event);
      case 'checkout.expired':
        return this.close(event.orderId, 'pending_payment', 'cancelled');
      case 'refund.succeeded': {
        const order = await this.byPayment(event.paymentId);
        return order ? this.close(order.id, null, 'refunded') : 'ignored';
      }
      case 'dispute.opened': {
        const order = await this.byPayment(event.paymentId);
        await this.db.collection(COLLECTIONS.adminAlerts).add({
          kind: 'payment_dispute',
          orderId: order?.id ?? null,
          step: null,
          message: `Contracargo abierto por ${String(event.amountMinor)}.`,
          createdAt: new Date(),
          resolvedAt: null,
        });
        this.log.error(
          { orderId: order?.id, paymentId: event.paymentId },
          'payment dispute opened',
        );
        return 'processed';
      }
      default:
        return 'ignored';
    }
  }

  /** Pago confirmado: monto y moneda tienen que coincidir con lo congelado en el pedido. */
  private async paid(event: Extract<PaymentEvent, { type: 'checkout.completed' }>) {
    const ref = this.db.collection(COLLECTIONS.orders).doc(event.orderId);
    const outcome = await this.db.runTransaction(async (tx) => {
      const order = (await tx.get(ref)).data() as OrderDoc | undefined;
      if (order?.status !== 'pending_payment') return { kind: 'ignored' as const };
      const expected = order.priceSnapshot;
      if (expected?.totalMinor !== event.amountMinor || expected.currency !== event.currency) {
        return { kind: 'mismatch' as const, order };
      }
      assertOrderTransition(order.status, 'paid');
      tx.update(ref, {
        status: 'paid',
        'payment.paymentId': event.paymentId,
        'payment.checkoutSessionId': event.sessionId,
        updatedAt: new Date(),
      });
      tx.update(this.db.collection(COLLECTIONS.books).doc(order.bookId), {
        status: 'ordered',
        updatedAt: new Date(),
      });
      if (order.couponCode) {
        tx.update(this.db.collection(COLLECTIONS.coupons).doc(order.couponCode), {
          redemptions: FieldValue.increment(1),
        });
      }
      return { kind: 'paid' as const, order };
    });
    if (outcome.kind === 'ignored') return 'ignored';
    if (outcome.kind === 'mismatch') {
      // No se fabrica nada si lo cobrado no es lo que congelamos: lo revisa una persona.
      await this.db.collection(COLLECTIONS.adminAlerts).add({
        kind: 'payment_mismatch',
        orderId: event.orderId,
        step: null,
        message: `Cobrado ${String(event.amountMinor)} ${event.currency}; esperado ${String(outcome.order.priceSnapshot?.totalMinor)} ${String(outcome.order.priceSnapshot?.currency)}.`,
        createdAt: new Date(),
        resolvedAt: null,
      });
      this.log.error({ orderId: event.orderId }, 'payment amount mismatch');
      return 'processed';
    }
    await this.events.publish({
      type: 'order.paid',
      orderId: event.orderId,
      requestId: `paid:${event.orderId}:${event.paymentId}`,
    });
    if (outcome.order.analyticsConsent) {
      await this.conversions
        .purchase({
          orderId: event.orderId,
          valueMinor: event.amountMinor,
          currency: event.currency,
        })
        .catch((error: unknown) => {
          this.log.warn({ err: error, orderId: event.orderId }, 'conversion report failed');
        });
    }
    return 'processed';
  }

  private async byPayment(paymentId: string) {
    const snap = await this.db
      .collection(COLLECTIONS.orders)
      .where('payment.paymentId', '==', paymentId)
      .limit(1)
      .get();
    return snap.docs[0] ?? null;
  }

  /** Cambia el estado si la transición vale (y, si se indica, solo desde `from`). */
  private async close(orderId: string, from: OrderStatus | null, to: OrderStatus) {
    const ref = this.db.collection(COLLECTIONS.orders).doc(orderId);
    return this.db.runTransaction(async (tx) => {
      const order = (await tx.get(ref)).data() as OrderDoc | undefined;
      if (!order || (from && order.status !== from) || !canTransitionOrder(order.status, to)) {
        return 'ignored' as const;
      }
      tx.update(ref, { status: to, updatedAt: new Date() });
      return 'processed' as const;
    });
  }

  // ------------------------------------------------------------------ reembolsos

  async refund(actor: { uid: string; email: string | null }, orderId: string, reason: string) {
    const ref = this.db.collection(COLLECTIONS.orders).doc(orderId);
    const order = (await ref.get()).data() as OrderDoc | undefined;
    if (!order) throw new AppError(404, 'not_found', 'Pedido inexistente.');
    if (!order.payment.paymentId || !canTransitionOrder(order.status, 'refunded')) {
      throw new AppError(
        409,
        'bad_request',
        `No se puede reembolsar un pedido en "${order.status}".`,
      );
    }
    const refund = await this.providers.payment().refund({
      paymentId: order.payment.paymentId,
      amountMinor: null,
      reason,
      idempotencyKey: `refund:${orderId}`,
    });
    const audit: AuditLogEntry = {
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: 'order.refund',
      entity: COLLECTIONS.orders,
      entityId: orderId,
      before: { status: order.status },
      after: { refundId: refund.refundId, refundStatus: refund.status, reason },
      at: new Date(),
    };
    await this.db.collection(COLLECTIONS.auditLog).add(audit);
    if (refund.status === 'succeeded') await this.close(orderId, null, 'refunded');
    const status = ((await ref.get()).data() as OrderDoc).status;
    return { status, refundId: refund.refundId };
  }

  // ------------------------------------------------------------------ desarrollo

  /** Pagos simulados: firma el evento como el proveedor y lo procesa igual que el webhook. */
  async simulatePayment(uid: string, orderId: string): Promise<PublicOrder> {
    const current = await this.order(uid, orderId);
    if (!current.canSimulatePayment || !current.priceSnapshot) {
      throw new AppError(409, 'bad_request', 'Este pedido no se puede simular.');
    }
    const webhook = signMockPaymentWebhook(this.options.mockWebhookSecret, {
      id: `evt_sim_${orderId}`,
      type: 'checkout.completed',
      data: {
        orderId,
        sessionId: `sim_${orderId}`,
        paymentId: `pay_sim_${orderId}`,
        amountMinor: current.priceSnapshot.totalMinor,
        currency: current.priceSnapshot.currency,
      },
    });
    await this.handleWebhook('mock', webhook.rawBody, webhook.headers);
    return this.order(uid, orderId);
  }
}

/** Timestamps de Firestore → Date. */
function dates(data: Record<string, unknown>, keys: string[]): Record<string, Date | null> {
  return Object.fromEntries(
    keys.map((key) => {
      const value = data[key];
      if (value instanceof Date) return [key, value];
      if (value && typeof value === 'object' && 'toDate' in value) {
        return [key, (value as { toDate(): Date }).toDate()];
      }
      return [key, null];
    }),
  );
}
