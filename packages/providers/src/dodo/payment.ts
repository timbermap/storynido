import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  ProviderError,
  WebhookSignatureError,
  currencySchema,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type Refund,
  type RefundRequest,
  type WebhookInput,
} from '@storynido/shared';
import { z } from 'zod';

export type DodoEnvironment = 'test_mode' | 'live_mode';

export interface DodoOptions {
  apiKey: string;
  /** Secreto del webhook (whsec_<base64>), del panel de Dodo. */
  webhookSecret: string;
  /** Producto "paga lo que quieras" (con mínimo): cada checkout le pisa el precio con `amount`. */
  productId: string;
  /** test_mode (por defecto) o live_mode: cambia la URL base. */
  environment?: DodoEnvironment;
  fetchImpl?: typeof fetch;
  /** Reloj inyectable para los tests de la ventana de tiempo del webhook. */
  now?: () => Date;
}

const BASE_URLS: Record<DodoEnvironment, string> = {
  test_mode: 'https://test.dodopayments.com',
  live_mode: 'https://live.dodopayments.com',
};

/** Ventana de tiempo de Standard Webhooks: más vieja (o más futura) se rechaza. */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
/** Dodo no informa vencimiento de la sesión: se guarda un día como referencia. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const checkoutResponseSchema = z.object({
  session_id: z.string(),
  checkout_url: z.string().nullish(),
});

const refundResponseSchema = z.object({
  refund_id: z.string(),
  status: z.string(),
});

const webhookSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const paymentSchema = z.object({
  payment_id: z.string(),
  total_amount: z.number().int().nonnegative(),
  currency: currencySchema,
  tax: z.number().int().nullish(),
  checkout_session_id: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

const refundSchema = z.object({
  payment_id: z.string(),
  amount: z.number().int().nullish(),
});

const disputeSchema = z.object({
  payment_id: z.string(),
  // Dodo manda el monto de la disputa como texto (en unidades menores).
  amount: z.union([z.string(), z.number()]),
});

/** Firma un webhook como lo hace Dodo (Standard Webhooks). Para tests. */
export function signDodoWebhook(
  secret: string,
  input: { id: string; timestamp: number; rawBody: string },
): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signed = `${input.id}.${String(input.timestamp)}.${input.rawBody}`;
  return `v1,${createHmac('sha256', key).update(signed).digest('base64')}`;
}

function safeEqualBase64(a: string, b: string): boolean {
  const left = Buffer.from(a, 'base64');
  const right = Buffer.from(b, 'base64');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/**
 * Dodo Payments (merchant of record) para lo digital. Se manda un solo ítem con el total que
 * calculamos nosotros (DECISIONS 072): el producto de Dodo es "paga lo que quieras" con impuestos
 * incluidos, así que `amount` fija el precio. Solo USD.
 */
export class DodoPaymentProvider implements PaymentProvider {
  readonly id = 'dodo';
  /** Dodo es merchant of record: el IVA va incluido en todos los países (DECISIONS 247). */
  readonly taxInclusive = true;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly now: () => Date;

  constructor(private readonly options: DodoOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = BASE_URLS[options.environment ?? 'test_mode'];
    this.now = options.now ?? (() => new Date());
  }

  private async post(
    path: string,
    body: unknown,
    idempotencyKey?: string,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          // Dodo no documenta idempotencia; si la ignora, el estado del pedido evita el doble cobro.
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 255) } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ProviderError(this.id, 'Sin respuesta de Dodo Payments', true, { cause: error });
    }
    const text = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        this.id,
        `Dodo Payments respondió HTTP ${String(response.status)}: ${text.slice(0, 300)}`,
        response.status >= 500 || response.status === 429,
      );
    }
    return JSON.parse(text) as Record<string, unknown>;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.currency !== 'USD') {
      throw new ProviderError(this.id, `Dodo solo cobra en USD (pedido en ${request.currency})`);
    }
    if (request.lineItems.length === 0) {
      throw new RangeError('El checkout necesita al menos un ítem');
    }
    if (request.lineItems.some((item) => item.amountMinor < 0 || item.quantity < 1)) {
      throw new RangeError('Montos o cantidades inválidos');
    }
    // Un solo ítem con el total: el producto de Dodo es uno y el precio lo pone el servidor.
    const total = request.lineItems.reduce(
      (sum, item) => sum + item.amountMinor * item.quantity,
      0,
    );
    const body = {
      product_cart: [{ product_id: this.options.productId, quantity: 1, amount: total }],
      ...(request.customerEmail ? { customer: { email: request.customerEmail } } : {}),
      return_url: request.successUrl,
      cancel_url: request.cancelUrl,
      metadata: { orderId: request.orderId },
    };
    const response = checkoutResponseSchema.parse(
      await this.post('/checkouts', body, `checkout:${request.orderId}`),
    );
    if (!response.checkout_url) {
      throw new ProviderError(this.id, 'Dodo no devolvió la URL del checkout');
    }
    return {
      id: response.session_id,
      url: response.checkout_url,
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_MS),
    };
  }

  /** Standard Webhooks: HMAC-SHA256 de "id.timestamp.cuerpo", en base64, con prefijo v1. */
  private verify(input: WebhookInput): string {
    const id = input.headers['webhook-id'];
    const timestamp = input.headers['webhook-timestamp'];
    const signatures = input.headers['webhook-signature'];
    if (!id || !timestamp || !signatures) {
      throw new WebhookSignatureError(this.id, 'Faltan los headers de firma');
    }
    const seconds = Number(timestamp);
    const age = Math.abs(this.now().getTime() / 1000 - seconds);
    if (!Number.isFinite(seconds) || age > WEBHOOK_TOLERANCE_SECONDS) {
      throw new WebhookSignatureError(this.id, 'Webhook fuera de la ventana de tiempo');
    }
    const expected = signDodoWebhook(this.options.webhookSecret, {
      id,
      timestamp: seconds,
      rawBody: input.rawBody,
    }).slice(3);
    // Puede venir más de una firma separada por espacios (rotación de secretos).
    const valid = signatures
      .split(' ')
      .some((entry) => entry.startsWith('v1,') && safeEqualBase64(entry.slice(3), expected));
    if (!valid) throw new WebhookSignatureError(this.id);
    return id;
  }

  parseWebhook(input: WebhookInput): PaymentEvent {
    const eventId = this.verify(input);
    const event = webhookSchema.parse(JSON.parse(input.rawBody));
    switch (event.type) {
      case 'payment.succeeded': {
        const payment = paymentSchema.parse(event.data);
        const orderId = payment.metadata?.orderId;
        if (typeof orderId !== 'string') return { type: 'ignored', eventId, rawType: event.type };
        return {
          type: 'checkout.completed',
          eventId,
          orderId,
          sessionId: payment.checkout_session_id ?? '',
          paymentId: payment.payment_id,
          amountMinor: payment.total_amount,
          currency: payment.currency,
          taxMinor: payment.tax ?? null,
        };
      }
      case 'payment.failed':
      case 'payment.cancelled': {
        const payment = paymentSchema.partial().parse(event.data);
        const orderId = payment.metadata?.orderId;
        if (typeof orderId !== 'string') return { type: 'ignored', eventId, rawType: event.type };
        return {
          type: 'checkout.expired',
          eventId,
          orderId,
          sessionId: payment.checkout_session_id ?? '',
        };
      }
      case 'refund.succeeded': {
        const refund = refundSchema.parse(event.data);
        return {
          type: 'refund.succeeded',
          eventId,
          paymentId: refund.payment_id,
          amountMinor: refund.amount ?? 0,
        };
      }
      case 'dispute.opened': {
        const dispute = disputeSchema.parse(event.data);
        return {
          type: 'dispute.opened',
          eventId,
          paymentId: dispute.payment_id,
          amountMinor: Math.round(Number(dispute.amount)) || 0,
        };
      }
      default:
        return { type: 'ignored', eventId, rawType: event.type };
    }
  }

  async refund(request: RefundRequest): Promise<Refund> {
    const body = {
      payment_id: request.paymentId,
      reason: request.reason.slice(0, 3000),
      // Reembolso parcial: Dodo lo pide por ítem (tenemos uno solo, el producto).
      ...(request.amountMinor !== null
        ? { items: [{ item_id: this.options.productId, amount: request.amountMinor }] }
        : {}),
      metadata: { idempotencyKey: request.idempotencyKey },
    };
    const response = refundResponseSchema.parse(
      await this.post('/refunds', body, request.idempotencyKey),
    );
    const status =
      response.status === 'succeeded'
        ? 'succeeded'
        : response.status === 'failed'
          ? 'failed'
          : 'pending';
    return { refundId: response.refund_id, status };
  }
}
