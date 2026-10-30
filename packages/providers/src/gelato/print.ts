import {
  GELATO_CARD_US,
  GELATO_PRODUCTS,
  ProviderError,
  printPageCount,
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

const ORDER_API = 'https://order.gelatoapis.com/v4';
const PRODUCT_API = 'https://product.gelatoapis.com/v3';

/** Estado de Gelato → estado de imprenta; los demás (creado, borrador, en espera) se ignoran. */
const STATUS: Partial<Record<string, PrintStatus>> = {
  passed: 'in_production',
  in_production: 'in_production',
  printed: 'in_production',
  shipped: 'shipped',
  in_transit: 'shipped',
  delivered: 'delivered',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  failed: 'failed',
};

const quoteSchema = z.object({
  quotes: z
    .array(
      z.object({
        products: z.array(z.object({ price: z.number() })),
        shipmentMethods: z.array(
          z.object({
            shipmentMethodUid: z.string(),
            type: z.string(),
            price: z.number(),
            minDeliveryDays: z.number(),
            maxDeliveryDays: z.number(),
          }),
        ),
      }),
    )
    .min(1),
});

const orderSchema = z.object({
  id: z.string(),
  orderReferenceId: z.string(),
  fulfillmentStatus: z.string(),
  shipment: z
    .object({
      packages: z
        .array(
          z.object({
            trackingCode: z.string().nullish(),
            trackingUrl: z.string().nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
});

const box = z.object({ width: z.number(), height: z.number(), left: z.number(), top: z.number() });
const coverSchema = z.object({
  wraparoundInsideSize: box.optional(),
  bleedSize: box.optional(),
  spineSize: box,
  contentFrontSize: box,
});

export interface GelatoOptions {
  apiKey: string;
  /** "draft": el pedido queda en borrador (no se fabrica ni se cobra). Staging usa draft. */
  orderType: 'draft' | 'order';
  products?: Record<PrintItem['format'], string>;
  fetchImpl?: typeof fetch;
}

/**
 * Gelato (fotolibros). El precio y el plazo salen de su cotización; el envío es el más barato.
 * Los webhooks de Gelato no vienen firmados: se verifican pidiendo el pedido a su API.
 */
export class GelatoPrintProvider implements PrintProvider {
  readonly id = 'gelato';
  private readonly products: Record<PrintItem['format'], string>;
  private readonly fetchImpl: typeof fetch;
  private readonly covers = new Map<string, Promise<PrintFileSpec>>();

  constructor(private readonly options: GelatoOptions) {
    this.products = options.products ?? GELATO_PRODUCTS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async call(url: string, init: { method?: string; body?: unknown } = {}) {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: init.method ?? 'GET',
        headers: { 'X-API-KEY': this.options.apiKey, 'content-type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new ProviderError(this.id, 'Sin respuesta de Gelato', true, { cause: error });
    }
    const text = await response.text();
    if (!response.ok) {
      // 4xx: Gelato no acepta el pedido (no tiene sentido reintentar con ella). 5xx y 429: sí.
      const retryable = response.status >= 500 || response.status === 429;
      throw new ProviderError(
        this.id,
        `HTTP ${String(response.status)}: ${text.slice(0, 200)}`,
        retryable,
      );
    }
    return text ? (JSON.parse(text) as unknown) : {};
  }

  private recipient(address: PrintAddress, email: string) {
    const [firstName = address.name, ...rest] = address.name.trim().split(/\s+/);
    return {
      firstName,
      lastName: rest.join(' ') || firstName,
      addressLine1: address.line1,
      ...(address.line2 ? { addressLine2: address.line2 } : {}),
      city: address.city,
      postCode: address.postalCode,
      ...(address.state ? { state: address.state } : {}),
      country: address.country,
      email,
      ...(address.phone ? { phone: address.phone } : {}),
    };
  }

  /** Producto de Gelato de un ítem: la tarjeta cambia de papel en EE. UU. */
  private productUid(item: PrintItem, country: string): string {
    return item.format === 'card' && country === 'US' ? GELATO_CARD_US : this.products[item.format];
  }

  /** Las tarjetas no tienen cantidad de páginas: el archivo trae frente y dorso. */
  private pages(item: PrintItem) {
    return item.format === 'card' ? {} : { pageCount: item.pageCount };
  }

  private async cheapest(
    items: readonly PrintItem[],
    address: PrintAddress,
    currency: Currency,
    reference: string,
  ) {
    const raw = await this.call(`${ORDER_API}/orders:quote`, {
      method: 'POST',
      body: {
        orderReferenceId: reference,
        customerReferenceId: 'storynido',
        currency,
        allowMultipleQuotes: false,
        recipient: this.recipient(address, 'pedidos@storynido.com'),
        products: items.map((item, index) => ({
          itemReferenceId: `${item.format}-${String(index)}`,
          productUid: this.productUid(item, address.country),
          ...this.pages(item),
          quantity: item.quantity,
        })),
      },
    });
    const parsed = quoteSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError(this.id, 'Cotización sin envíos disponibles');
    const quote = parsed.data.quotes[0];
    const shipping = [...(quote?.shipmentMethods ?? [])].sort(
      (a, b) =>
        Number(a.type !== 'normal') - Number(b.type !== 'normal') ||
        a.price - b.price ||
        a.maxDeliveryDays - b.maxDeliveryDays,
    )[0];
    if (!quote || !shipping) throw new ProviderError(this.id, 'No envía a ese destino');
    const production = quote.products.reduce((sum, product) => sum + product.price, 0);
    return { production, shipping };
  }

  async quote(
    items: readonly PrintItem[],
    address: PrintAddress,
    currency: Currency,
  ): Promise<PrintQuote> {
    const { production, shipping } = await this.cheapest(items, address, currency, 'quote');
    const minor = (value: number) => Math.round(value * 100);
    return {
      currency,
      shippingMinor: minor(shipping.price),
      productionCostUsdMinor: currency === 'USD' ? minor(production) : 0,
      totalCostUsdMinor: currency === 'USD' ? minor(production + shipping.price) : 0,
      etaDaysMin: shipping.minDeliveryDays,
      etaDaysMax: shipping.maxDeliveryDays,
    };
  }

  async createOrder(request: PrintOrderRequest): Promise<PrintOrder> {
    // Idempotente: si el pedido ya existe en Gelato (reintento), se devuelve ese.
    const found = z.object({ orders: z.array(z.object({ id: z.string() })).default([]) }).parse(
      await this.call(`${ORDER_API}/orders:search`, {
        method: 'POST',
        body: { orderReferenceIds: [request.orderId], limit: 1 },
      }),
    );
    const existing = found.orders[0];
    if (existing) return { externalOrderId: existing.id, status: 'received' };

    const { shipping } = await this.cheapest(
      request.items,
      request.address,
      'USD',
      request.orderId,
    );
    const created = orderSchema.pick({ id: true }).parse(
      await this.call(`${ORDER_API}/orders`, {
        method: 'POST',
        body: {
          orderType: this.options.orderType,
          orderReferenceId: request.orderId,
          customerReferenceId: request.orderId,
          currency: 'USD',
          shipmentMethodUid: shipping.shipmentMethodUid,
          items: request.items.map((item, index) => {
            if (!item.bookPdfUrl) {
              throw new ProviderError(this.id, 'Gelato necesita el libro en un solo PDF');
            }
            return {
              itemReferenceId: `${request.orderId}-${String(index)}`,
              productUid: this.productUid(item, request.address.country),
              ...this.pages(item),
              quantity: item.quantity,
              files: [{ type: 'default', url: item.bookPdfUrl }],
            };
          }),
          shippingAddress: this.recipient(request.address, request.email),
        },
      }),
    );
    return { externalOrderId: created.id, status: 'received' };
  }

  async cancelOrder(externalOrderId: string) {
    try {
      await this.call(`${ORDER_API}/orders/${encodeURIComponent(externalOrderId)}:cancel`, {
        method: 'POST',
      });
      return { cancelled: true, reason: null };
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) {
        return { cancelled: false, reason: 'Gelato ya no permite cancelarlo' };
      }
      throw error;
    }
  }

  async parseWebhook(input: WebhookInput): Promise<PrintEvent> {
    const payload = z
      .object({
        id: z.string().optional(),
        event: z.string(),
        orderId: z.string().optional(),
        orderReferenceId: z.string().optional(),
      })
      .loose()
      .safeParse(JSON.parse(input.rawBody));
    if (!payload.success) throw new WebhookSignatureError(this.id, 'Webhook de Gelato inválido');
    const { event, orderId } = payload.data;
    if (!orderId || !event.startsWith('order_')) {
      return { type: 'ignored', eventId: payload.data.id ?? event, rawType: event };
    }
    // Lo que manda el webhook no se cree: se consulta el pedido con nuestra clave.
    let order: z.infer<typeof orderSchema>;
    try {
      order = orderSchema.parse(
        await this.call(`${ORDER_API}/orders/${encodeURIComponent(orderId)}`),
      );
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) throw error;
      throw new WebhookSignatureError(this.id, 'El pedido del webhook no existe en Gelato');
    }
    if (payload.data.orderReferenceId && payload.data.orderReferenceId !== order.orderReferenceId) {
      throw new WebhookSignatureError(this.id, 'El webhook no coincide con el pedido');
    }
    const status = STATUS[order.fulfillmentStatus];
    const tracking = order.shipment?.packages?.find((item) => item.trackingCode) ?? null;
    if (!status) {
      return {
        type: 'ignored',
        eventId: `${order.id}:${order.fulfillmentStatus}`,
        rawType: `${event}:${order.fulfillmentStatus}`,
      };
    }
    return {
      type: 'status',
      // Un evento por estado (y por seguimiento): los repetidos se descartan.
      eventId: `${order.id}:${status}:${tracking?.trackingCode ?? ''}`,
      orderId: order.orderReferenceId,
      externalOrderId: order.id,
      status,
      trackingNumber: tracking?.trackingCode ?? null,
      trackingUrl: tracking?.trackingUrl ?? null,
    };
  }

  /** Pliego de tapa según las páginas (el lomo cambia) y un solo PDF con guardas. */
  fileSpec(item: PrintItem): Promise<PrintFileSpec> {
    // Tarjeta 5×7": un PDF de dos páginas (frente y dorso), 127×178 mm con 3 mm de sangrado.
    if (item.format === 'card') {
      return Promise.resolve({
        packaging: 'booklet',
        trim: { widthMm: 127, heightMm: 178 },
        bleedMm: 3,
      });
    }
    // Cuento grapado A5: un solo PDF con las tapas como primera y última página (sin lomo).
    if (item.format === 'booklet') {
      return Promise.resolve({
        packaging: 'booklet',
        trim: { widthMm: 148, heightMm: 210 },
        bleedMm: 3,
        minInteriorPages: printPageCount(item.format, item.pageCount) - 2,
      });
    }
    const key = `${item.format}:${String(item.pageCount)}`;
    let spec = this.covers.get(key);
    if (!spec) {
      spec = this.call(
        `${PRODUCT_API}/products/${encodeURIComponent(this.products[item.format])}/cover-dimensions?pageCount=${String(item.pageCount)}`,
      ).then((raw) => {
        const cover = coverSchema.parse((raw as { products?: unknown[] }).products?.[0] ?? raw);
        const sheet = cover.wraparoundInsideSize ?? cover.bleedSize;
        if (!sheet) throw new ProviderError(this.id, 'Gelato no informó el tamaño de la tapa');
        return {
          packaging: 'single',
          cover: {
            widthMm: sheet.width,
            heightMm: sheet.height,
            spineLeftMm: cover.spineSize.left,
            spineWidthMm: cover.spineSize.width,
            // Del borde del pliego al corte: la vuelta en tapa dura, el sangrado en tapa blanda.
            edgeMm: cover.contentFrontSize.top,
          },
        };
      });
      spec.catch(() => this.covers.delete(key));
      this.covers.set(key, spec);
    }
    return spec;
  }
}
