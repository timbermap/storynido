import {
  ProviderError,
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutSession,
  type Locale,
  type PaymentEvent,
  type PaymentProvider,
  type Refund,
  type RefundRequest,
  type WebhookInput,
} from '@storynido/shared';
import { z } from 'zod';

export type PaypalEnvironment = 'sandbox' | 'live';

export interface PaypalOptions {
  /** Client ID de la app REST (developer.paypal.com → Apps & Credentials). */
  clientId: string;
  clientSecret: string;
  /** ID del webhook registrado en la app: PayPal lo exige para verificar la firma. */
  webhookId: string;
  /** sandbox (por defecto, no cobra) o live. */
  environment?: PaypalEnvironment;
  /** Nombre que ve el comprador en la página de PayPal. */
  brandName?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const BASE_URLS: Record<PaypalEnvironment, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

/** Una orden de PayPal sin aprobar vence a las 3 horas (aprox.): se guarda ese plazo. */
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
/** El token OAuth dura ~9 h; se renueva un poco antes. */
const TOKEN_MARGIN_MS = 60 * 1000;

/** Idioma de la página de PayPal según el del sitio. */
const PAYPAL_LOCALES: Record<Locale, string> = {
  es: 'es-MX',
  pt: 'pt-BR',
  en: 'en-US',
};

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });

const linkSchema = z.object({ href: z.string(), rel: z.string() });

const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
  links: z.array(linkSchema).default([]),
});

const moneySchema = z.object({ currency_code: z.string(), value: z.string() });

const captureSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: moneySchema,
  custom_id: z.string().nullish(),
  invoice_id: z.string().nullish(),
  supplementary_data: z
    .object({ related_ids: z.object({ order_id: z.string().nullish() }).partial().nullish() })
    .partial()
    .nullish(),
});

const capturedOrderSchema = z.object({
  id: z.string(),
  status: z.string(),
  purchase_units: z
    .array(
      z.object({
        payments: z
          .object({ captures: z.array(captureSchema).default([]) })
          .partial()
          .nullish(),
      }),
    )
    .default([]),
});

/** La primera captura de una orden (las nuestras tienen un solo ítem y una sola captura). */
function firstCapture(order: z.infer<typeof capturedOrderSchema>) {
  return order.purchase_units[0]?.payments?.captures?.[0] ?? null;
}

const refundResponseSchema = z.object({ id: z.string(), status: z.string() });

const webhookSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  resource: z.record(z.string(), z.unknown()),
});

const approvedOrderSchema = z.object({
  id: z.string(),
  purchase_units: z
    .array(z.object({ custom_id: z.string().nullish(), reference_id: z.string().nullish() }))
    .default([]),
});

const refundResourceSchema = z.object({
  id: z.string(),
  amount: moneySchema,
  links: z.array(linkSchema).default([]),
});

const disputeSchema = z.object({
  dispute_id: z.string(),
  dispute_amount: moneySchema.nullish(),
  disputed_transactions: z
    .array(z.object({ seller_transaction_id: z.string().nullish() }))
    .default([]),
});

const verifySchema = z.object({ verification_status: z.string() });

/** "21.99" → 2199. PayPal manda montos como texto con dos decimales (USD). */
export function paypalMinor(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [whole = '0', fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function paypalValue(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * PayPal (Orders v2) para cobrar en USD. No es merchant of record: el IVA va incluido en el precio
 * y sale del margen, como con Dodo (DECISIONS 247 y 279).
 *
 * Flujo: se crea la orden con `intent: CAPTURE` y el comprador la aprueba en PayPal (con su cuenta o
 * con tarjeta, sin cuenta). PayPal lo devuelve solo a `successUrl`. El webhook
 * `CHECKOUT.ORDER.APPROVED` dispara la captura desde el servidor; `PAYMENT.CAPTURE.COMPLETED`
 * confirma el cobro. Los dos traducen a `checkout.completed`: el pedido pasa a pagado una sola vez.
 */
export class PaypalPaymentProvider implements PaymentProvider {
  readonly id = 'paypal';
  readonly taxInclusive = true;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly baseUrl: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly options: PaypalOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.baseUrl = BASE_URLS[options.environment ?? 'sandbox'];
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now().getTime()) return this.token.value;
    const basic = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString(
      'base64',
    );
    const data = await this.call('/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      auth: false,
    });
    const parsed = tokenSchema.parse(data.json);
    this.token = {
      value: parsed.access_token,
      expiresAt: this.now().getTime() + parsed.expires_in * 1000 - TOKEN_MARGIN_MS,
    };
    return parsed.access_token;
  }

  /** Llama a la API; devuelve el estado y el JSON (o null) sin lanzar por errores de negocio. */
  private async call(
    path: string,
    init: {
      method: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: string;
      auth?: boolean;
    },
  ): Promise<{ status: number; ok: boolean; json: unknown; text: string }> {
    const headers: Record<string, string> = { ...init.headers };
    if (init.auth !== false) {
      headers.Authorization = `Bearer ${await this.accessToken()}`;
      headers['Content-Type'] ??= 'application/json';
    }
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ProviderError(this.id, 'Sin respuesta de PayPal', true, { cause: error });
    }
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (init.auth === false && !response.ok) {
      throw new ProviderError(
        this.id,
        `PayPal rechazó las credenciales (HTTP ${String(response.status)})`,
        response.status >= 500,
      );
    }
    return { status: response.status, ok: response.ok, json, text };
  }

  private fail(action: string, result: { status: number; text: string }): never {
    throw new ProviderError(
      this.id,
      `PayPal no pudo ${action} (HTTP ${String(result.status)}): ${result.text.slice(0, 300)}`,
      result.status >= 500 || result.status === 429,
    );
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.currency !== 'USD') {
      throw new ProviderError(this.id, `Se cobra en USD (pedido en ${request.currency})`);
    }
    if (request.lineItems.length === 0) {
      throw new RangeError('El checkout necesita al menos un ítem');
    }
    if (
      request.lineItems.some(
        (item) => !Number.isInteger(item.amountMinor) || item.amountMinor < 0 || item.quantity < 1,
      )
    ) {
      throw new RangeError('Montos o cantidades inválidos');
    }
    const total = request.lineItems.reduce(
      (sum, item) => sum + item.amountMinor * item.quantity,
      0,
    );
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: request.orderId,
          custom_id: request.orderId,
          invoice_id: request.orderId,
          description: 'StoryNido',
          amount: {
            currency_code: 'USD',
            value: paypalValue(total),
            breakdown: { item_total: { currency_code: 'USD', value: paypalValue(total) } },
          },
          items: request.lineItems.map((item) => ({
            name: item.name.slice(0, 127),
            quantity: String(item.quantity),
            unit_amount: { currency_code: 'USD', value: paypalValue(item.amountMinor) },
            category: 'DIGITAL_GOODS',
          })),
        },
      ],
      // application_context (no payment_source.paypal): la misma orden sirve para el botón de
      // PayPal, para el de tarjeta sin cuenta en nuestra página y para el enlace de respaldo.
      application_context: {
        brand_name: (this.options.brandName ?? 'StoryNido').slice(0, 127),
        locale: PAYPAL_LOCALES[request.locale],
        landing_page: 'NO_PREFERENCE',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: request.successUrl,
        cancel_url: request.cancelUrl,
      },
    };
    const result = await this.call('/v2/checkout/orders', {
      method: 'POST',
      // Idempotencia: reintentar con el mismo pedido devuelve la misma orden.
      headers: { 'PayPal-Request-Id': `order-${request.orderId}` },
      body: JSON.stringify(body),
    });
    if (!result.ok) this.fail('crear la orden', result);
    const order = orderSchema.parse(result.json);
    const approve = order.links.find(
      (link) => link.rel === 'payer-action' || link.rel === 'approve',
    );
    if (!approve) throw new ProviderError(this.id, 'PayPal no devolvió el enlace de pago');
    return {
      id: order.id,
      url: approve.href,
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_MS),
    };
  }

  /** Verificación con la API de PayPal (el cuerpo crudo va tal cual, sin volver a serializar). */
  private async verify(input: WebhookInput): Promise<void> {
    const h = input.headers;
    const fields = {
      auth_algo: h['paypal-auth-algo'],
      cert_url: h['paypal-cert-url'],
      transmission_id: h['paypal-transmission-id'],
      transmission_sig: h['paypal-transmission-sig'],
      transmission_time: h['paypal-transmission-time'],
    };
    if (Object.values(fields).some((value) => !value)) {
      throw new WebhookSignatureError(this.id, 'Faltan las cabeceras de firma de PayPal');
    }
    const prefix = JSON.stringify({ ...fields, webhook_id: this.options.webhookId });
    const body = `${prefix.slice(0, -1)},"webhook_event":${input.rawBody}}`;
    const result = await this.call('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body,
    });
    if (!result.ok) this.fail('verificar el webhook', result);
    if (verifySchema.parse(result.json).verification_status !== 'SUCCESS') {
      throw new WebhookSignatureError(this.id);
    }
  }

  async parseWebhook(input: WebhookInput): Promise<PaymentEvent> {
    // Antes de verificar: un cuerpo que no es JSON no es de PayPal.
    let raw: unknown;
    try {
      raw = JSON.parse(input.rawBody);
    } catch {
      throw new WebhookSignatureError(this.id, 'Cuerpo inválido');
    }
    await this.verify(input);
    const event = webhookSchema.parse(raw);
    const eventId = event.id;
    const ignored = { type: 'ignored' as const, eventId, rawType: event.event_type };

    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        const order = approvedOrderSchema.parse(event.resource);
        const orderId = order.purchase_units[0]?.custom_id ?? order.purchase_units[0]?.reference_id;
        if (!orderId) return ignored;
        const capture = await this.capture(order.id);
        if (capture?.status !== 'COMPLETED') return ignored;
        return this.completed(eventId, orderId, order.id, capture);
      }
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = captureSchema.parse(event.resource);
        const orderId = capture.custom_id ?? capture.invoice_id;
        if (!orderId) return ignored;
        const sessionId = capture.supplementary_data?.related_ids?.order_id ?? orderId;
        return this.completed(eventId, orderId, sessionId, capture);
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const refund = refundResourceSchema.parse(event.resource);
        // El reembolso apunta a su captura con el enlace "up" (…/v2/payments/captures/<id>).
        const up = refund.links.find((link) => link.rel === 'up')?.href ?? '';
        const paymentId = /\/captures\/([^/?]+)/.exec(up)?.[1];
        if (!paymentId) return ignored;
        return {
          type: 'refund.succeeded',
          eventId,
          paymentId,
          amountMinor: paypalMinor(refund.amount.value),
        };
      }
      case 'CUSTOMER.DISPUTE.CREATED': {
        const dispute = disputeSchema.parse(event.resource);
        const paymentId = dispute.disputed_transactions[0]?.seller_transaction_id;
        if (!paymentId) return ignored;
        return {
          type: 'dispute.opened',
          eventId,
          paymentId,
          amountMinor: dispute.dispute_amount ? paypalMinor(dispute.dispute_amount.value) : 0,
        };
      }
      default:
        return ignored;
    }
  }

  private completed(
    eventId: string,
    orderId: string,
    sessionId: string,
    capture: z.infer<typeof captureSchema>,
  ): PaymentEvent {
    if (capture.amount.currency_code !== 'USD') {
      throw new ProviderError(this.id, `Captura en ${capture.amount.currency_code}, no en USD`);
    }
    return {
      type: 'checkout.completed',
      eventId,
      orderId,
      sessionId,
      paymentId: capture.id,
      amountMinor: paypalMinor(capture.amount.value),
      currency: 'USD',
      taxMinor: null,
    };
  }

  /** Lee la orden en PayPal: su estado y las capturas que tenga. */
  private async readOrder(paypalOrderId: string): Promise<z.infer<typeof capturedOrderSchema>> {
    const result = await this.call(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
      method: 'GET',
    });
    if (!result.ok) this.fail('leer la orden', result);
    return capturedOrderSchema.parse(result.json);
  }

  /**
   * Cobra la orden solo si PayPal la tiene aprobada. Antes se lee su estado: si ya está cobrada
   * (llegó antes el webhook o la vuelta a la página) se devuelve esa captura, y si todavía no está
   * aprobada no se intenta. Así PayPal no registra errores 422 (ORDER_ALREADY_CAPTURED,
   * ORDER_NOT_APPROVED) en el panel. La clave de idempotencia hace que dos cobros simultáneos
   * reciban la misma captura; si igual llega un 422 por una carrera, se vuelve a leer la orden.
   */
  private async capture(paypalOrderId: string): Promise<z.infer<typeof captureSchema> | null> {
    const current = await this.readOrder(paypalOrderId);
    if (current.status === 'COMPLETED') return firstCapture(current);
    if (current.status !== 'APPROVED') return null;
    const result = await this.call(
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      { method: 'POST', headers: { 'PayPal-Request-Id': `capture-${paypalOrderId}` } },
    );
    if (result.status === 422 && result.text.includes('ORDER_ALREADY_CAPTURED')) {
      return firstCapture(await this.readOrder(paypalOrderId));
    }
    if (!result.ok) this.fail('capturar el pago', result);
    return firstCapture(capturedOrderSchema.parse(result.json));
  }

  /**
   * El comprador aprobó en nuestra página (botones de PayPal): se cobra ya, sin esperar el webhook.
   * Si ya estaba cobrada (llegó antes el webhook), se usa la captura que tiene la orden.
   */
  async confirm(sessionId: string, orderId: string): Promise<PaymentEvent | null> {
    const capture = await this.capture(sessionId);
    if (capture?.status !== 'COMPLETED') return null;
    return this.completed(`confirm-${capture.id}`, orderId, sessionId, capture);
  }

  async refund(request: RefundRequest): Promise<Refund> {
    const body =
      request.amountMinor === null
        ? {}
        : { amount: { currency_code: 'USD', value: paypalValue(request.amountMinor) } };
    const result = await this.call(
      `/v2/payments/captures/${encodeURIComponent(request.paymentId)}/refund`,
      {
        method: 'POST',
        headers: { 'PayPal-Request-Id': request.idempotencyKey },
        body: JSON.stringify(body),
      },
    );
    if (!result.ok) this.fail('reembolsar', result);
    const refund = refundResponseSchema.parse(result.json);
    const status =
      refund.status === 'COMPLETED'
        ? 'succeeded'
        : refund.status === 'FAILED' || refund.status === 'CANCELLED'
          ? 'failed'
          : 'pending';
    return { refundId: refund.id, status };
  }
}
