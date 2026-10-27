import type { Currency } from '../currency';
import type { Locale } from '../i18n';
import type { WebhookInput } from './errors';

export interface CheckoutLineItem {
  name: string;
  amountMinor: number;
  quantity: number;
}

export interface CheckoutRequest {
  /** Nuestro ID de pedido: también es la clave de idempotencia. */
  orderId: string;
  customerEmail: string | null;
  currency: Currency;
  locale: Locale;
  lineItems: readonly CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  expiresAt: Date;
}

export type PaymentEvent =
  | {
      type: 'checkout.completed';
      eventId: string;
      orderId: string;
      sessionId: string;
      paymentId: string;
      amountMinor: number;
      currency: Currency;
    }
  | { type: 'checkout.expired'; eventId: string; orderId: string; sessionId: string }
  | { type: 'refund.succeeded'; eventId: string; paymentId: string; amountMinor: number }
  /** Contracargo abierto: el admin tiene que responder con evidencia. */
  | { type: 'dispute.opened'; eventId: string; paymentId: string; amountMinor: number }
  | { type: 'ignored'; eventId: string; rawType: string };

export interface RefundRequest {
  paymentId: string;
  /** Si se omite, reembolso total. */
  amountMinor: number | null;
  reason: string;
  idempotencyKey: string;
}

export interface Refund {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface PaymentProvider {
  readonly id: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Verifica la firma y traduce el evento. Lanza WebhookSignatureError si la firma es inválida. */
  parseWebhook(input: WebhookInput): PaymentEvent;
  refund(request: RefundRequest): Promise<Refund>;
}
