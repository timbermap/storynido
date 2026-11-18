import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  ProviderError,
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type Refund,
  type RefundRequest,
  type WebhookInput,
} from '@storynido/shared';
import { z } from 'zod';

export interface GumroadOptions {
  /** Página del producto "paga lo que quieras" (https://<usuario>.gumroad.com/l/<permalink>). */
  productUrl: string;
  /** Token de la API (Settings → Advanced → Applications), para los reembolsos. */
  accessToken: string;
  /** Secreto con el que Gumroad firma los pings (Settings → Advanced → "Sign pings"). */
  pingSecret: string;
  /**
   * Gumroad no tiene modo de prueba: la compra del propio vendedor llega con `test=true` y no cobra.
   * Fuera de producción se toma como pago (así se prueba staging); en producción se ignora.
   */
  acceptTestSales?: boolean;
  fetchImpl?: typeof fetch;
  /** Reloj inyectable para los tests de la ventana de tiempo del ping. */
  now?: () => Date;
}

/** Gumroad recomienda rechazar pings con más de 5 minutos de diferencia con el reloj propio. */
const PING_TOLERANCE_SECONDS = 5 * 60;
/** No hay sesión de checkout en Gumroad: se guarda un día como referencia. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** Parámetro propio en la URL del producto: Gumroad lo devuelve en el ping como url_params[order_id]. */
const ORDER_PARAM = 'order_id';

const refundResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  sale: z.object({ id: z.string() }).partial().optional(),
});

/** Firma un ping como Gumroad (X-Gumroad-Signature). Para tests. */
export function signGumroadPing(secret: string, timestamp: number, rawBody: string): string {
  const digest = createHmac('sha256', secret)
    .update(`${String(timestamp)}.${rawBody}`)
    .digest('hex');
  return `t=${String(timestamp)},v1=${digest}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** Centavos enteros (el ping manda montos en centavos de USD, como texto del formulario). */
function cents(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Gumroad (merchant of record) como puente para cobrar lo digital (DECISIONS 255).
 * No hay API de checkout: se arma la URL del producto "paga lo que quieras" con el total del
 * servidor (`price`, en dólares), `wanted=true` (va directo al pago) y nuestro `order_id`, que
 * vuelve en el ping. El monto cobrado se compara con el pedido congelado: si el comprador cambia
 * el precio, el pedido no se fabrica (aviso al admin). Solo USD; el IVA de UE/Reino Unido lo
 * suma Gumroad encima (no va incluido).
 */
export class GumroadPaymentProvider implements PaymentProvider {
  readonly id = 'gumroad';
  readonly taxInclusive = false;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly options: GumroadOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.currency !== 'USD') {
      return Promise.reject(
        new ProviderError(this.id, `Gumroad solo cobra en USD (pedido en ${request.currency})`),
      );
    }
    if (request.lineItems.length === 0) {
      return Promise.reject(new RangeError('El checkout necesita al menos un ítem'));
    }
    if (request.lineItems.some((item) => item.amountMinor < 0 || item.quantity < 1)) {
      return Promise.reject(new RangeError('Montos o cantidades inválidos'));
    }
    const total = request.lineItems.reduce(
      (sum, item) => sum + item.amountMinor * item.quantity,
      0,
    );
    const url = new URL(this.options.productUrl);
    url.searchParams.set('wanted', 'true');
    // Gumroad lee `price` en unidades de la moneda (19.99) y lo pasa a centavos.
    url.searchParams.set('price', (total / 100).toFixed(2));
    url.searchParams.set(ORDER_PARAM, request.orderId);
    // El mail no va en la URL: Gumroad no lo precarga desde ahí y quedaría en logs e historial.
    return Promise.resolve({
      id: request.orderId,
      url: url.toString(),
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_MS),
    });
  }

  /** X-Gumroad-Signature: t=<segundos>,v1=<hex HMAC-SHA256 de "t.cuerpo crudo">. */
  private verify(input: WebhookInput): void {
    const header = input.headers['x-gumroad-signature'];
    if (!header) throw new WebhookSignatureError(this.id, 'Falta la firma del ping');
    const parts = new Map(
      header.split(',').map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const;
      }),
    );
    const timestamp = parts.get('t') ?? '';
    const received = parts.get('v1') ?? '';
    const seconds = /^\d+$/.test(timestamp) ? Number(timestamp) : Number.NaN;
    if (
      !Number.isFinite(seconds) ||
      Math.abs(this.now().getTime() / 1000 - seconds) > PING_TOLERANCE_SECONDS
    ) {
      throw new WebhookSignatureError(this.id, 'Ping fuera de la ventana de tiempo');
    }
    const expected = signGumroadPing(this.options.pingSecret, seconds, input.rawBody).split(
      'v1=',
    )[1];
    if (!expected || !safeEqualHex(received, expected)) throw new WebhookSignatureError(this.id);
  }

  parseWebhook(input: WebhookInput): PaymentEvent {
    this.verify(input);
    // El ping llega como x-www-form-urlencoded; los diccionarios como url_params[clave].
    const form = new URLSearchParams(input.rawBody);
    const saleId = form.get('sale_id');
    if (!saleId) throw new ProviderError(this.id, 'Ping sin sale_id');
    const resource = form.get('resource_name') ?? 'sale';
    // Una venta y su reembolso comparten sale_id: el evento se deduplica con los dos.
    const eventId = `${saleId}:${resource}`;
    const isTest = form.get('test') === 'true';
    const ignored = { type: 'ignored' as const, eventId, rawType: resource };
    const amountMinor = cents(form.get('price'));

    switch (resource) {
      case 'sale': {
        const orderId = form.get(`url_params[${ORDER_PARAM}]`);
        // Una venta sin nuestro order_id no es un pedido de StoryNido (otro link o la tienda).
        if (!orderId) return ignored;
        if (isTest && !this.options.acceptTestSales) return ignored;
        if (form.get('refunded') === 'true') return ignored;
        return {
          type: 'checkout.completed',
          eventId,
          orderId,
          sessionId: orderId,
          paymentId: saleId,
          // `price` es lo que pagó el comprador sin el IVA que agrega Gumroad, siempre en centavos de USD.
          amountMinor,
          currency: 'USD',
          taxMinor: null,
        };
      }
      case 'refund':
        return isTest
          ? ignored
          : { type: 'refund.succeeded', eventId, paymentId: saleId, amountMinor };
      case 'dispute':
        return isTest
          ? ignored
          : { type: 'dispute.opened', eventId, paymentId: saleId, amountMinor };
      default:
        return ignored;
    }
  }

  async refund(request: RefundRequest): Promise<Refund> {
    const body = new URLSearchParams({ access_token: this.options.accessToken });
    if (request.amountMinor !== null) body.set('amount_cents', String(request.amountMinor));
    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://api.gumroad.com/v2/sales/${encodeURIComponent(request.paymentId)}/refund`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (error) {
      throw new ProviderError(this.id, 'Sin respuesta de Gumroad', true, { cause: error });
    }
    const text = await response.text();
    let parsed: z.infer<typeof refundResponseSchema> | null = null;
    try {
      parsed = refundResponseSchema.parse(JSON.parse(text));
    } catch {
      parsed = null;
    }
    if (!response.ok || !parsed?.success) {
      throw new ProviderError(
        this.id,
        `Gumroad no reembolsó (HTTP ${String(response.status)}): ${(parsed?.message ?? text).slice(0, 300)}`,
        response.status >= 500 || response.status === 429,
      );
    }
    // Gumroad no da un ID de reembolso: se usa el de la venta (el ping "refund" confirma).
    return { refundId: parsed.sale?.id ?? request.paymentId, status: 'succeeded' };
  }
}
