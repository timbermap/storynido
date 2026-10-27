import type { FastifyBaseLogger } from 'fastify';

export interface PurchaseEvent {
  orderId: string;
  valueMinor: number;
  currency: string;
}

/** Conversiones del lado del servidor (solo con consentimiento de analítica). */
export interface ConversionReporter {
  purchase(event: PurchaseEvent): Promise<void>;
}

/** Monedas sin decimales (CLP, COP en la práctica) para pasar a unidades. */
const ZERO_DECIMAL = new Set(['CLP', 'JPY']);

const toUnits = (event: PurchaseEvent) =>
  ZERO_DECIMAL.has(event.currency) ? event.valueMinor : event.valueMinor / 100;

export interface ConversionKeys {
  /** GA4 Measurement Protocol. */
  ga4MeasurementId?: string;
  ga4ApiSecret?: string;
  /** Meta API de Conversiones. */
  metaPixelId?: string;
  metaAccessToken?: string;
}

/**
 * Envía la compra a GA4 y a Meta si hay claves configuradas. Sin datos personales: solo el ID
 * del pedido, el valor y la moneda. Sin claves, no hace nada (y lo deja en el log).
 */
export class ServerConversions implements ConversionReporter {
  constructor(
    private readonly keys: ConversionKeys,
    private readonly log: FastifyBaseLogger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async purchase(event: PurchaseEvent): Promise<void> {
    const sends: Promise<unknown>[] = [];
    const value = toUnits(event);
    if (this.keys.ga4MeasurementId && this.keys.ga4ApiSecret) {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(this.keys.ga4MeasurementId)}&api_secret=${encodeURIComponent(this.keys.ga4ApiSecret)}`;
      sends.push(
        this.fetchImpl(url, {
          method: 'POST',
          body: JSON.stringify({
            // Sin cookie del navegador: un ID de cliente derivado del pedido.
            client_id: `order.${event.orderId}`,
            events: [
              {
                name: 'purchase',
                params: { transaction_id: event.orderId, value, currency: event.currency },
              },
            ],
          }),
        }),
      );
    }
    if (this.keys.metaPixelId && this.keys.metaAccessToken) {
      const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(this.keys.metaPixelId)}/events?access_token=${encodeURIComponent(this.keys.metaAccessToken)}`;
      sends.push(
        this.fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            data: [
              {
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                event_id: event.orderId,
                action_source: 'website',
                custom_data: { value, currency: event.currency, order_id: event.orderId },
              },
            ],
          }),
        }),
      );
    }
    if (sends.length === 0) {
      this.log.info({ orderId: event.orderId }, 'purchase conversion skipped (no keys)');
      return;
    }
    await Promise.all(sends);
  }
}

/** Tests: guarda las compras reportadas. */
export class RecordingConversions implements ConversionReporter {
  readonly purchases: PurchaseEvent[] = [];

  purchase(event: PurchaseEvent): Promise<void> {
    this.purchases.push(event);
    return Promise.resolve();
  }
}
