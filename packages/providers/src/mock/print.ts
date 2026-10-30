import {
  PRINT_STATUSES,
  WebhookSignatureError,
  type CountryCode,
  type Currency,
  type PrintAddress,
  type PrintEvent,
  type PrintItem,
  type PrintOrder,
  type PrintOrderRequest,
  type PrintProvider,
  type PrintQuote,
  type WebhookInput,
} from '@storynido/shared';
import { z } from 'zod';

import { hmacHex, safeEqualHex, stableId } from '../crypto';

export const MOCK_PRINT_SIGNATURE_HEADER = 'x-mock-print-signature';

/** Imprentas simuladas (sin pedidos reales): habilitan "Avanzar la imprenta" fuera de producción. */
export const isSimulatedPrinter = (id: string) => id === 'mock' || id === 'mock_alt';

const webhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    orderId: z.string(),
    externalOrderId: z.string(),
    status: z.enum(PRINT_STATUSES),
    trackingNumber: z.string().nullable().default(null),
    trackingUrl: z.string().nullable().default(null),
  }),
});

type MockPrintWebhook = z.input<typeof webhookSchema>;

export function signMockPrintWebhook(secret: string, payload: MockPrintWebhook): WebhookInput {
  const rawBody = JSON.stringify(payload);
  return { rawBody, headers: { [MOCK_PRINT_SIGNATURE_HEADER]: hmacHex(secret, rawBody) } };
}

/** Secuencia de webhooks que emite la imprenta simulada para un pedido (fase 12). */
export function mockPrintWebhookSequence(
  orderId: string,
  externalOrderId: string,
): MockPrintWebhook[] {
  const tracking = `MOCK${externalOrderId.slice(-8).toUpperCase()}`;
  return [
    {
      id: `${externalOrderId}:in_production`,
      type: 'order.status',
      data: { orderId, externalOrderId, status: 'in_production' },
    },
    {
      id: `${externalOrderId}:shipped`,
      type: 'order.status',
      data: {
        orderId,
        externalOrderId,
        status: 'shipped',
        trackingNumber: tracking,
        trackingUrl: `https://tracking.example.com/${tracking}`,
      },
    },
    {
      id: `${externalOrderId}:delivered`,
      type: 'order.status',
      data: { orderId, externalOrderId, status: 'delivered' },
    },
  ];
}

/** Costos de ejemplo (en unidad mínima de la moneda pedida). */
const SHIPPING_MINOR: Partial<Record<Currency, number>> = {
  MXN: 9900,
  USD: 699,
  EUR: 599,
  BRL: 2990,
};
/** Envío de ejemplo por país, en centavos de USD (para comparar imprentas). */
const SHIPPING_USD_MINOR: Partial<Record<CountryCode, number>> = { MX: 550, US: 699 };

export interface MockPrintCosts {
  id: string;
  productionUsdMinor: Record<PrintItem['format'], number>;
  shippingUsdMinor: Partial<Record<CountryCode, number>>;
}

const DEFAULT_COSTS: MockPrintCosts = {
  id: 'mock',
  productionUsdMinor: { softcover: 900, hardcover: 1400, booklet: 700, card: 25 },
  shippingUsdMinor: SHIPPING_USD_MINOR,
};

export class MockPrintProvider implements PrintProvider {
  readonly id: string;
  private readonly shipped = new Set<string>();
  private readonly costs: MockPrintCosts;

  constructor(
    private readonly webhookSecret: string,
    costs: Partial<MockPrintCosts> = {},
  ) {
    this.costs = {
      ...DEFAULT_COSTS,
      ...costs,
      shippingUsdMinor: { ...SHIPPING_USD_MINOR, ...costs.shippingUsdMinor },
    };
    this.id = this.costs.id;
  }

  quote(
    items: readonly PrintItem[],
    address: PrintAddress,
    currency: Currency,
  ): Promise<PrintQuote> {
    if (items.length === 0) return Promise.reject(new RangeError('Sin ítems para cotizar'));
    const production = items.reduce(
      (sum, item) => sum + this.costs.productionUsdMinor[item.format] * item.quantity,
      0,
    );
    const shippingUsd = this.costs.shippingUsdMinor[address.country] ?? 1200;
    return Promise.resolve({
      currency,
      shippingMinor: SHIPPING_MINOR[currency] ?? 1000,
      productionCostUsdMinor: production,
      totalCostUsdMinor: production + shippingUsd,
      etaDaysMin: address.country === 'US' ? 4 : 5,
      etaDaysMax: address.country === 'US' ? 8 : 10,
    });
  }

  createOrder(request: PrintOrderRequest): Promise<PrintOrder> {
    if (request.items.length === 0)
      return Promise.reject(new RangeError('Sin ítems para imprimir'));
    return Promise.resolve({
      externalOrderId: stableId(`${this.id}_po`, request.orderId),
      status: 'received',
    });
  }

  cancelOrder(externalOrderId: string): Promise<{ cancelled: boolean; reason: string | null }> {
    return Promise.resolve(
      this.shipped.has(externalOrderId)
        ? { cancelled: false, reason: 'El pedido ya fue despachado' }
        : { cancelled: true, reason: null },
    );
  }

  parseWebhook(input: WebhookInput): PrintEvent {
    const signature = input.headers[MOCK_PRINT_SIGNATURE_HEADER] ?? '';
    if (!safeEqualHex(signature, hmacHex(this.webhookSecret, input.rawBody))) {
      throw new WebhookSignatureError(this.id);
    }
    const raw = z
      .object({ id: z.string(), type: z.string() })
      .loose()
      .parse(JSON.parse(input.rawBody));
    if (raw.type !== 'order.status') return { type: 'ignored', eventId: raw.id, rawType: raw.type };
    const { id, data } = webhookSchema.parse(raw);
    if (data.status === 'shipped' || data.status === 'delivered')
      this.shipped.add(data.externalOrderId);
    return { type: 'status', eventId: id, ...data };
  }
}
