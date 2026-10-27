import type { Currency } from '../currency';
import type { CountryCode } from '../countries';
import type { WebhookInput } from './errors';

export interface PrintAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: CountryCode;
  phone: string | null;
}

export interface PrintItem {
  format: 'softcover' | 'hardcover';
  pageCount: number;
  quantity: number;
}

export interface PrintQuote {
  currency: Currency;
  shippingMinor: number;
  productionCostUsdMinor: number;
  /** Impresión + envío en centavos de USD: con esto se elige la imprenta más barata. */
  totalCostUsdMinor: number;
  etaDaysMin: number;
  etaDaysMax: number;
}

export interface PrintOrderRequest {
  /** Nuestro ID de pedido: también es la clave de idempotencia. */
  orderId: string;
  items: readonly (PrintItem & { interiorPdfUrl: string; coverPdfUrl: string })[];
  address: PrintAddress;
  email: string;
  currency: Currency;
}

export interface PrintOrder {
  externalOrderId: string;
  status: 'received' | 'in_production';
}

export const PRINT_STATUSES = [
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
  'failed',
] as const;

export type PrintStatus = (typeof PRINT_STATUSES)[number];

export type PrintEvent =
  | {
      type: 'status';
      eventId: string;
      orderId: string;
      externalOrderId: string;
      status: PrintStatus;
      trackingNumber: string | null;
      trackingUrl: string | null;
    }
  | { type: 'ignored'; eventId: string; rawType: string };

export interface PrintProvider {
  readonly id: string;
  quote(
    items: readonly PrintItem[],
    address: PrintAddress,
    currency: Currency,
  ): Promise<PrintQuote>;
  /**
   * Crea el pedido en la imprenta. Un ProviderError no reintentable (`retryable: false`) significa
   * que esta imprenta no lo acepta: se prueba con la siguiente.
   */
  createOrder(request: PrintOrderRequest): Promise<PrintOrder>;
  cancelOrder(externalOrderId: string): Promise<{ cancelled: boolean; reason: string | null }>;
  /** Verifica la firma y traduce el evento. Lanza WebhookSignatureError si es inválida. */
  parseWebhook(input: WebhookInput): PrintEvent;
}
