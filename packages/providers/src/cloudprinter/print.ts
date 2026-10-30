import { timingSafeEqual } from 'node:crypto';

import {
  CLOUDPRINTER_PRODUCTS,
  photobookFormat,
  type PhotobookFormat,
  ProviderError,
  WebhookSignatureError,
  type Currency,
  type PrintAddress,
  type PrintEvent,
  type PrintFileSpec,
  type PrintItem,
  type PrintOrder,
  type PrintOrderRequest,
  type PrintProvider,
  type PrintQuote,
  type PrintStatus,
  type WebhookInput,
} from '@storynido/shared';
import { z } from 'zod';

const API = 'https://api.cloudprinter.com/cloudcore/1.0';

/** US Letter al corte, en mm. */
const TRIM = { widthMm: 215.9, heightMm: 279.4 } as const;
const BLEED_MM = 3;
/** Tapa dura: el cartón se envuelve 18 mm hacia adentro. */
const CASEWRAP_MM = 18;
/** Papel interior por defecto (200 g, estucado mate: volumen 0,8). */
const PAPER = { gsm: 200, bulk: 0.8 };
/** Grosor de tapa para el lomo (docs de Cloudprinter: cómo calcular el lomo). */
const COVER_THICKNESS_MM: Record<PhotobookFormat, number> = { softcover: 0.5, hardcover: 3 };

/** Plazo estimado por nivel de envío (Cloudprinter no lo informa en la cotización). */
const ETA_DAYS: Record<string, [number, number]> = {
  cp_postal: [7, 15],
  cp_ground: [5, 10],
  cp_saver: [4, 8],
  cp_fast: [2, 5],
};

/** Señal de Cloudprinter → estado de imprenta (las demás se ignoran). */
const STATUS: Partial<Record<string, PrintStatus>> = {
  ItemProduce: 'in_production',
  ItemProduced: 'in_production',
  ItemPacked: 'in_production',
  ItemShipped: 'shipped',
  ItemDeliveryStarted: 'shipped',
  ItemDeliveryCompleted: 'delivered',
  ItemCanceled: 'cancelled',
  ItemDeliveryFailed: 'failed',
};

const quoteSchema = z.object({
  subtotals: z.object({
    items: z.coerce.number(),
    fee: z.coerce.number().nullish(),
    app_fee: z.coerce.number().nullish(),
  }),
  shipments: z.array(
    z.object({
      quotes: z.array(
        z.object({
          quote: z.string(),
          shipping_level: z.string(),
          price: z.coerce.number(),
        }),
      ),
    }),
  ),
});

const signalSchema = z
  .object({
    apikey: z.string(),
    type: z.string(),
    order: z.union([z.string(), z.number()]).optional(),
    order_reference: z.string().optional(),
    item: z.union([z.string(), z.number()]).optional(),
    tracking: z.string().nullish(),
    url: z.string().nullish(),
    datetime: z.string().optional(),
    delay: z.union([z.string(), z.number()]).nullish(),
  })
  .loose();

export interface CloudprinterOptions {
  apiKey: string;
  /** Clave del webhook (CloudSignal): cada señal la trae y se verifica. */
  webhookKey: string | null;
  fetchImpl?: typeof fetch;
}

/** Lomo en mm con la fórmula de Cloudprinter (gramaje × volumen × hojas ÷ 1000 + 2 tapas). */
export function cloudprinterSpineMm(format: PhotobookFormat, pages: number) {
  const spine = (PAPER.gsm * PAPER.bulk * (pages / 2)) / 1000 + 2 * COVER_THICKNESS_MM[format];
  return Math.round(spine * 100) / 100;
}

/**
 * Cloudprinter: produce cerca del cliente (México incluido). Pide tapa y tripa en dos PDF con
 * MD5, en tamaño US Letter. Las señales de estado (CloudSignal) traen una clave propia que se
 * verifica en cada aviso. Su modo sandbox no imprime ni cobra y simula los avisos.
 */
export class CloudprinterPrintProvider implements PrintProvider {
  readonly id = 'cloudprinter';
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: CloudprinterOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async call(path: string, body: Record<string, unknown>) {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apikey: this.options.apiKey, ...body }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new ProviderError(this.id, 'Sin respuesta de Cloudprinter', true, { cause: error });
    }
    const text = await response.text();
    if (!response.ok) {
      const retryable = response.status >= 500 || response.status === 429;
      throw Object.assign(
        new ProviderError(
          this.id,
          `HTTP ${String(response.status)}: ${text.slice(0, 200)}`,
          retryable,
        ),
        { status: response.status },
      );
    }
    return text ? (JSON.parse(text) as unknown) : {};
  }

  private items(items: readonly PrintItem[], reference: string) {
    return items.map((item, index) => ({
      reference: `${reference}-${String(index)}`,
      product: CLOUDPRINTER_PRODUCTS[photobookFormat(this.id, item.format)],
      count: String(item.quantity),
      options: [{ type: 'total_pages', count: String(item.pageCount) }],
    }));
  }

  private async cheapest(items: readonly PrintItem[], address: PrintAddress, reference: string) {
    const parsed = quoteSchema.safeParse(
      await this.call('orders/quote', {
        country: address.country,
        ...(address.state ? { state: address.state } : {}),
        currency: 'USD',
        items: this.items(items, reference),
      }),
    );
    if (!parsed.success) throw new ProviderError(this.id, 'Cotización sin envíos disponibles');
    const quotes = parsed.data.shipments.flatMap((shipment) => shipment.quotes);
    const shipping = [...quotes].sort((a, b) => a.price - b.price)[0];
    if (!shipping) throw new ProviderError(this.id, 'No envía a ese destino');
    const { subtotals } = parsed.data;
    const production = subtotals.items + (subtotals.fee ?? 0) + (subtotals.app_fee ?? 0);
    return { production, shipping };
  }

  async quote(
    items: readonly PrintItem[],
    address: PrintAddress,
    currency: Currency,
  ): Promise<PrintQuote> {
    const { production, shipping } = await this.cheapest(items, address, 'quote');
    const minor = (value: number) => Math.round(value * 100);
    const [etaDaysMin, etaDaysMax] = ETA_DAYS[shipping.shipping_level] ?? [5, 12];
    return {
      currency,
      shippingMinor: minor(shipping.price),
      productionCostUsdMinor: minor(production),
      totalCostUsdMinor: minor(production + shipping.price),
      etaDaysMin,
      etaDaysMax,
    };
  }

  private async exists(reference: string) {
    try {
      await this.call('orders/info', { reference });
      return true;
    } catch (error) {
      if ((error as { status?: number }).status === 410) return false;
      throw error;
    }
  }

  async createOrder(request: PrintOrderRequest): Promise<PrintOrder> {
    // Idempotente: nuestra referencia es la del pedido; si ya existe (reintento), se devuelve.
    if (await this.exists(request.orderId)) {
      return { externalOrderId: request.orderId, status: 'received' };
    }
    const { shipping } = await this.cheapest(request.items, request.address, request.orderId);
    const [firstname = request.address.name, ...rest] = request.address.name.trim().split(/\s+/);
    await this.call('orders/add', {
      reference: request.orderId,
      email: request.email,
      addresses: [
        {
          type: 'delivery',
          firstname,
          lastname: rest.join(' ') || firstname,
          street1: request.address.line1,
          ...(request.address.line2 ? { street2: request.address.line2 } : {}),
          zip: request.address.postalCode,
          city: request.address.city,
          ...(request.address.state ? { state: request.address.state } : {}),
          country: request.address.country,
          email: request.email,
          phone: request.address.phone ?? '',
        },
      ],
      items: request.items.map((item, index) => {
        if (!item.interiorPdfUrl || !item.coverPdfUrl || !item.interiorMd5 || !item.coverMd5) {
          throw new ProviderError(this.id, 'Cloudprinter necesita tapa y tripa por separado');
        }
        return {
          reference: `${request.orderId}-${String(index)}`,
          product: CLOUDPRINTER_PRODUCTS[photobookFormat(this.id, item.format)],
          count: String(item.quantity),
          quote: shipping.quote,
          files: [
            { type: 'cover', url: item.coverPdfUrl, md5sum: item.coverMd5 },
            { type: 'book', url: item.interiorPdfUrl, md5sum: item.interiorMd5 },
          ],
          options: [{ type: 'total_pages', count: String(item.pageCount) }],
        };
      }),
    });
    return { externalOrderId: request.orderId, status: 'received' };
  }

  async cancelOrder(externalOrderId: string) {
    try {
      await this.call('orders/cancel', { reference: externalOrderId });
      return { cancelled: true, reason: null };
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) {
        return { cancelled: false, reason: 'Cloudprinter ya no permite cancelarlo' };
      }
      throw error;
    }
  }

  parseWebhook(input: WebhookInput): PrintEvent {
    const parsed = signalSchema.safeParse(JSON.parse(input.rawBody));
    if (!parsed.success) throw new WebhookSignatureError(this.id, 'Señal inválida');
    const signal = parsed.data;
    // Cada señal trae la clave del webhook configurada en Cloudprinter.
    const expected = Buffer.from(this.options.webhookKey ?? '');
    const given = Buffer.from(signal.apikey);
    if (
      expected.length === 0 ||
      expected.length !== given.length ||
      !timingSafeEqual(expected, given)
    ) {
      throw new WebhookSignatureError(this.id);
    }
    const eventId = [signal.order, signal.item, signal.type, signal.datetime].join(':');
    // Un error con demora es un aviso de atraso, no una falla: se ignora.
    const status = signal.type === 'ItemError' && !signal.delay ? 'failed' : STATUS[signal.type];
    if (!status || !signal.order_reference) {
      return { type: 'ignored', eventId, rawType: signal.type };
    }
    return {
      type: 'status',
      eventId,
      orderId: signal.order_reference,
      externalOrderId: signal.order_reference,
      status,
      trackingNumber: signal.tracking ?? null,
      trackingUrl: signal.url ?? null,
    };
  }

  /** Tamaño US Letter, tripa y tapa por separado; la tapa con su lomo calculado. */
  fileSpec(item: PrintItem): Promise<PrintFileSpec> {
    const spine = cloudprinterSpineMm(photobookFormat(this.id, item.format), item.pageCount);
    const edge = item.format === 'hardcover' ? CASEWRAP_MM : BLEED_MM;
    return Promise.resolve({
      packaging: 'separate',
      trim: TRIM,
      cover: {
        widthMm: Math.round((2 * TRIM.widthMm + spine + 2 * edge) * 100) / 100,
        heightMm: Math.round((TRIM.heightMm + 2 * edge) * 100) / 100,
        spineLeftMm: Math.round((edge + TRIM.widthMm) * 100) / 100,
        spineWidthMm: spine,
        edgeMm: edge,
      },
    });
  }
}
