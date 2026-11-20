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
      /** Impuesto que el cobrador incluyó en el cobro (Dodo), si lo informa. */
      taxMinor?: number | null;
      /** Comisión real que cobró el procesador (USD, centavos), si la informa (PayPal). */
      feeMinor?: number | null;
      /** Lo que queda en la billetera después de la comisión (USD, centavos). */
      netMinor?: number | null;
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

/** Saldo de la billetera del procesador en una moneda (unidad mínima). */
export interface ProviderBalance {
  currency: string;
  totalMinor: number;
  availableMinor: number;
  withheldMinor: number;
}

export type ProviderTransactionKind = 'payment' | 'refund' | 'withdrawal' | 'dispute' | 'other';

/** Un movimiento de la billetera. Importes con signo: un reembolso o un retiro son negativos. */
export interface ProviderTransaction {
  id: string;
  kind: ProviderTransactionKind;
  /** Código del procesador (PayPal: T0006, T1107…). */
  code: string;
  status: string;
  at: Date;
  currency: string;
  grossMinor: number;
  /** Comisión con signo (negativa cuando se cobra). */
  feeMinor: number;
  /** Nuestro número de pedido, si el movimiento lo trae (custom_id / invoice_id). */
  orderId: string | null;
  /** Para reembolsos y contracargos: el cobro original. */
  relatedId: string | null;
}

export interface ProviderDispute {
  id: string;
  status: string;
  reason: string;
  currency: string;
  amountMinor: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Cobro (captura) disputado. */
  paymentId: string | null;
}

/**
 * Lectura de la billetera del procesador para el admin. Solo consulta: no mueve plata, no
 * reembolsa ni retira.
 */
export interface PaymentReporting {
  environment: 'sandbox' | 'live';
  balances(): Promise<ProviderBalance[]>;
  /** Movimientos entre dos fechas (el procesador limita el rango a 31 días por consulta). */
  transactions(from: Date, to: Date): Promise<ProviderTransaction[]>;
  disputes(): Promise<ProviderDispute[]>;
}

export interface PaymentProvider {
  readonly id: string;
  /**
   * Merchant of record con impuestos incluidos: el IVA va incluido en el precio en todos los
   * países y sale del margen (DECISIONS 247).
   */
  readonly taxInclusive?: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Verifica la firma y traduce el evento. Lanza WebhookSignatureError si la firma es inválida.
   * Puede ser asíncrono (PayPal verifica con su API y captura el pago aprobado).
   */
  parseWebhook(input: WebhookInput): PaymentEvent | Promise<PaymentEvent>;
  refund(request: RefundRequest): Promise<Refund>;
  /**
   * Confirma en el momento un pago que el comprador aprobó en nuestra página (PayPal embebido):
   * cobra la sesión y devuelve el evento, o null si todavía no hay nada que confirmar. El webhook
   * sigue llegando igual; aplicar los dos es seguro porque el pedido solo pasa a pagado una vez.
   */
  confirm?(sessionId: string, orderId: string): Promise<PaymentEvent | null>;
  /** Saldo, movimientos y disputas del procesador (solo lectura), si sabe informarlos. */
  readonly reporting?: PaymentReporting;
}
