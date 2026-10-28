import { CLOUDPRINTER_PRODUCTS, WebhookSignatureError } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { CloudprinterPrintProvider, cloudprinterSpineMm } from './print';

const address = {
  name: 'Ana María Pérez',
  line1: 'Av. Reforma 123',
  line2: null,
  city: 'Ciudad de México',
  state: 'CDMX',
  postalCode: '06600',
  country: 'MX' as const,
  phone: '+525512345678',
};

/** Cloudprinter de mentira: responde según la ruta y guarda cada llamada. */
function fake(
  routes: Record<string, (body: Record<string, unknown>) => { status?: number; json: unknown }>,
) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const path = url.split('/cloudcore/1.0/')[1] ?? '';
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    calls.push({ path, body });
    const reply = routes[path]?.(body) ?? { status: 404, json: {} };
    return Promise.resolve(
      new Response(JSON.stringify(reply.json), { status: reply.status ?? 200 }),
    );
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const QUOTE = {
  price: '13.49',
  subtotals: { items: '5.23', fee: '0.00', app_fee: '0.00' },
  shipments: [
    {
      quotes: [
        { quote: 'q-fast', shipping_level: 'cp_fast', price: '19.00' },
        { quote: 'q-saver', shipping_level: 'cp_saver', price: '8.26' },
      ],
    },
  ],
};

const provider = (fetchImpl: typeof fetch) =>
  new CloudprinterPrintProvider({ apiKey: 'k', webhookKey: 'hook-key', fetchImpl });

describe('Cloudprinter', () => {
  it('cotiza con el envío más barato y la clave va en el cuerpo', async () => {
    const api = fake({ 'orders/quote': () => ({ json: QUOTE }) });
    const quote = await provider(api.fetchImpl).quote(
      [{ format: 'softcover', pageCount: 28, quantity: 1 }],
      address,
      'USD',
    );
    expect(quote).toMatchObject({
      productionCostUsdMinor: 523,
      shippingMinor: 826,
      totalCostUsdMinor: 1349,
      etaDaysMin: 4,
      etaDaysMax: 8,
    });
    expect(api.calls[0]?.body).toMatchObject({
      apikey: 'k',
      country: 'MX',
      currency: 'USD',
      items: [
        {
          product: CLOUDPRINTER_PRODUCTS.softcover,
          count: '1',
          options: [{ type: 'total_pages', count: '28' }],
        },
      ],
    });
  });

  it('crea el pedido una sola vez, con tapa y tripa y su MD5', async () => {
    let created = 0;
    const api = fake({
      'orders/info': () =>
        created > 0 ? { json: { reference: 'o-1' } } : { status: 410, json: {} },
      'orders/quote': () => ({ json: QUOTE }),
      'orders/add': () => {
        created += 1;
        return { status: 201, json: { order: 'o-1' } };
      },
    });
    const request = {
      orderId: 'o-1',
      items: [
        {
          format: 'hardcover' as const,
          pageCount: 28,
          quantity: 1,
          interiorPdfUrl: 'https://storage.test/interior.pdf',
          coverPdfUrl: 'https://storage.test/cover.pdf',
          bookPdfUrl: null,
          interiorMd5: 'aaa',
          coverMd5: 'bbb',
        },
      ],
      address,
      email: 'ana@example.com',
      currency: 'USD' as const,
    };
    const printer = provider(api.fetchImpl);
    expect(await printer.createOrder(request)).toEqual({
      externalOrderId: 'o-1',
      status: 'received',
    });
    expect(await printer.createOrder(request)).toEqual({
      externalOrderId: 'o-1',
      status: 'received',
    });
    expect(created).toBe(1);
    const order = api.calls.find((call) => call.path === 'orders/add')?.body;
    expect(order).toMatchObject({
      reference: 'o-1',
      addresses: [
        {
          type: 'delivery',
          firstname: 'Ana',
          lastname: 'María Pérez',
          zip: '06600',
          state: 'CDMX',
        },
      ],
      items: [
        {
          product: CLOUDPRINTER_PRODUCTS.hardcover,
          quote: 'q-saver',
          files: [
            { type: 'cover', url: 'https://storage.test/cover.pdf', md5sum: 'bbb' },
            { type: 'book', url: 'https://storage.test/interior.pdf', md5sum: 'aaa' },
          ],
        },
      ],
    });
  });

  it('las señales se verifican con la clave del webhook y se traducen', () => {
    const printer = provider(fake({}).fetchImpl);
    const signal = (overrides: Record<string, unknown>) => ({
      rawBody: JSON.stringify({
        apikey: 'hook-key',
        type: 'ItemShipped',
        order: '123',
        item: '124',
        order_reference: 'o-1',
        item_reference: 'o-1-0',
        tracking: '1A2B',
        url: 'https://tracking.test/1A2B',
        datetime: '2026-11-02T10:00:00+00:00',
        ...overrides,
      }),
      headers: {},
    });
    expect(printer.parseWebhook(signal({}))).toEqual({
      type: 'status',
      eventId: '123:124:ItemShipped:2026-11-02T10:00:00+00:00',
      orderId: 'o-1',
      externalOrderId: 'o-1',
      status: 'shipped',
      trackingNumber: '1A2B',
      trackingUrl: 'https://tracking.test/1A2B',
    });
    expect(() => printer.parseWebhook(signal({ apikey: 'otra' }))).toThrow(WebhookSignatureError);
    expect(printer.parseWebhook(signal({ type: 'ItemDeliveryCompleted' }))).toMatchObject({
      status: 'delivered',
    });
    // Un error con demora es un atraso, no una falla.
    expect(printer.parseWebhook(signal({ type: 'ItemError', delay: 24 }))).toMatchObject({
      type: 'ignored',
    });
    expect(printer.parseWebhook(signal({ type: 'ItemError' }))).toMatchObject({ status: 'failed' });
  });

  it('US Letter: lomo con la fórmula de Cloudprinter y la vuelta de 18 mm en tapa dura', async () => {
    expect(cloudprinterSpineMm('softcover', 28)).toBe(3.24);
    expect(cloudprinterSpineMm('hardcover', 28)).toBe(8.24);
    const printer = provider(fake({}).fetchImpl);
    const soft = await printer.fileSpec({ format: 'softcover', pageCount: 28, quantity: 1 });
    expect(soft).toEqual({
      packaging: 'separate',
      trim: { widthMm: 215.9, heightMm: 279.4 },
      cover: {
        widthMm: 441.04,
        heightMm: 285.4,
        spineLeftMm: 218.9,
        spineWidthMm: 3.24,
        edgeMm: 3,
      },
    });
    const hard = await printer.fileSpec({ format: 'hardcover', pageCount: 28, quantity: 1 });
    expect(hard.cover).toEqual({
      widthMm: 476.04,
      heightMm: 315.4,
      spineLeftMm: 233.9,
      spineWidthMm: 8.24,
      edgeMm: 18,
    });
  });
});
