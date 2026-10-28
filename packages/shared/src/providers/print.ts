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

/**
 * Cómo pide los archivos una imprenta. "separate": tripa y tapa en dos PDF. "single": un solo
 * PDF con el pliego de tapa, una guarda en blanco, la tripa y otra guarda (Gelato).
 */
export interface PrintFileSpec {
  packaging: 'separate' | 'single';
  /** Tamaño de página al corte de esta imprenta (si no, nuestro 210×280 mm). */
  trim?: { widthMm: number; heightMm: number };
  /** Sangrado del interior que pide la imprenta (si no, el nuestro de 3 mm). */
  bleedMm?: number;
  /**
   * Páginas interiores mínimas: si el libro tiene menos, se completa con páginas para dibujar
   * antes del cierre (Lulu pide 32 en tapa blanda).
   */
  minInteriorPages?: number;
  /** Pliego de tapa (contratapa + lomo + tapa), en mm, con sangrado o vuelta incluidos. */
  cover: {
    widthMm: number;
    heightMm: number;
    spineLeftMm: number;
    spineWidthMm: number;
    /** Distancia del borde del pliego al corte (sangrado, o vuelta en tapa dura). */
    edgeMm: number;
  };
}

export interface PrintOrderFiles {
  /** "separate": tripa y tapa; "single": el libro entero en un PDF. */
  interiorPdfUrl: string | null;
  coverPdfUrl: string | null;
  bookPdfUrl: string | null;
  /** MD5 de cada archivo (algunas imprentas lo piden para verificar la descarga). */
  interiorMd5?: string | null;
  coverMd5?: string | null;
  bookMd5?: string | null;
}

export interface PrintOrderRequest {
  /** Nuestro ID de pedido: también es la clave de idempotencia. */
  orderId: string;
  items: readonly (PrintItem & PrintOrderFiles)[];
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
  /**
   * Verifica el webhook (firma, o consultando el pedido a la imprenta) y lo traduce. Lanza
   * WebhookSignatureError si no se puede verificar.
   */
  parseWebhook(input: WebhookInput): PrintEvent | Promise<PrintEvent>;
  /** Archivos que pide para este libro. Sin esto, tripa y tapa genéricas por separado. */
  fileSpec?(item: PrintItem): Promise<PrintFileSpec>;
}
