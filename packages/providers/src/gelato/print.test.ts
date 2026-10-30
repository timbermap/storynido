import { describe, expect, it } from 'vitest';

import {
  GELATO_CARD_US,
  GELATO_PRODUCTS,
  ProviderError,
  WebhookSignatureError,
} from '@storynido/shared';

import { GelatoPrintProvider } from './print';

const address = {
  name: 'Ana María Pérez',
  line1: '350 5th Ave',
  line2: null,
  city: 'New York',
  state: 'NY',
  postalCode: '10118',
  country: 'US' as const,
  phone: '+12125551234',
};

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** Gelato de mentira: responde según la ruta y guarda cada llamada. */
function fakeGelato(routes: Record<string, (body: unknown) => { status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ url, method: init?.method ?? 'GET', body });
    const key = Object.keys(routes).find((route) => url.includes(route));
    const reply = key ? routes[key]?.(body) : { status: 404, json: { message: 'no' } };
    return Promise.resolve(
      new Response(JSON.stringify(reply?.json ?? {}), { status: reply?.status ?? 200 }),
    );
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const QUOTE = {
  quotes: [
    {
      products: [{ price: 9.86 }],
      shipmentMethods: [
        {
          shipmentMethodUid: 'express_fast',
          type: 'express',
          price: 5.0,
          minDeliveryDays: 2,
          maxDeliveryDays: 3,
        },
        {
          shipmentMethodUid: 'ups_ground',
          type: 'normal',
          price: 18.64,
          minDeliveryDays: 5,
          maxDeliveryDays: 6,
        },
        {
          shipmentMethodUid: 'usps_ground',
          type: 'normal',
          price: 6.99,
          minDeliveryDays: 6,
          maxDeliveryDays: 7,
        },
      ],
    },
  ],
};

const printer = (fetchImpl: typeof fetch, orderType: 'draft' | 'order' = 'draft') =>
  new GelatoPrintProvider({ apiKey: 'test-key', orderType, fetchImpl });

describe('Gelato', () => {
  it('cotiza con el envío normal más barato, en centavos de USD', async () => {
    const gelato = fakeGelato({ 'orders:quote': () => ({ json: QUOTE }) });
    const quote = await printer(gelato.fetchImpl).quote(
      [{ format: 'softcover', pageCount: 28, quantity: 1 }],
      address,
      'USD',
    );
    expect(quote).toMatchObject({
      shippingMinor: 699,
      productionCostUsdMinor: 986,
      totalCostUsdMinor: 1685,
      etaDaysMin: 6,
      etaDaysMax: 7,
    });
    const body = gelato.calls[0]?.body as { products: { productUid: string; pageCount: number }[] };
    expect(body.products[0]).toMatchObject({
      productUid: GELATO_PRODUCTS.softcover,
      pageCount: 28,
    });
  });

  it('crea el pedido en borrador con el PDF único, una sola vez', async () => {
    let created = 0;
    const gelato = fakeGelato({
      'orders:search': () => ({ json: { orders: created > 0 ? [{ id: 'g-1' }] : [] } }),
      'orders:quote': () => ({ json: QUOTE }),
      '/v4/orders': () => {
        created += 1;
        return { json: { id: 'g-1' } };
      },
    });
    const request = {
      orderId: 'o-1',
      items: [
        {
          format: 'hardcover' as const,
          pageCount: 28,
          quantity: 1,
          interiorPdfUrl: null,
          coverPdfUrl: null,
          bookPdfUrl: 'https://storage.test/book.pdf',
        },
      ],
      address,
      email: 'ana@example.com',
      currency: 'USD' as const,
    };
    const provider = printer(gelato.fetchImpl);
    expect(await provider.createOrder(request)).toEqual({
      externalOrderId: 'g-1',
      status: 'received',
    });
    // Reintento: lo encuentra por nuestra referencia y no crea otro.
    expect((await provider.createOrder(request)).externalOrderId).toBe('g-1');
    expect(created).toBe(1);
    const order = gelato.calls.find((call) => call.url.endsWith('/v4/orders'))?.body as Record<
      string,
      unknown
    >;
    expect(order).toMatchObject({
      orderType: 'draft',
      orderReferenceId: 'o-1',
      shipmentMethodUid: 'usps_ground',
      items: [
        {
          productUid: GELATO_PRODUCTS.hardcover,
          pageCount: 28,
          files: [{ type: 'default', url: 'https://storage.test/book.pdf' }],
        },
      ],
      shippingAddress: {
        firstName: 'Ana',
        lastName: 'María Pérez',
        postCode: '10118',
        email: 'ana@example.com',
      },
    });
  });

  it('un rechazo (4xx) pasa a la siguiente imprenta; un 5xx se reintenta', async () => {
    const reject = fakeGelato({
      'orders:quote': () => ({ status: 400, json: { message: 'bad' } }),
    });
    const failed = printer(reject.fetchImpl).quote(
      [{ format: 'softcover', pageCount: 28, quantity: 1 }],
      address,
      'USD',
    );
    await expect(failed).rejects.toMatchObject({ retryable: false });
    const down = fakeGelato({ 'orders:quote': () => ({ status: 503, json: {} }) });
    const retry = printer(down.fetchImpl).quote(
      [{ format: 'softcover', pageCount: 28, quantity: 1 }],
      address,
      'USD',
    );
    await expect(retry).rejects.toBeInstanceOf(ProviderError);
    await expect(retry).rejects.toMatchObject({ retryable: true });
  });

  it('el webhook se verifica consultando el pedido a Gelato', async () => {
    const gelato = fakeGelato({
      '/v4/orders/g-1': () => ({
        json: {
          id: 'g-1',
          orderReferenceId: 'o-1',
          fulfillmentStatus: 'shipped',
          shipment: {
            packages: [{ trackingCode: '1Z999', trackingUrl: 'https://ups.test/1Z999' }],
          },
        },
      }),
    });
    const provider = printer(gelato.fetchImpl);
    // Aunque el webhook diga otra cosa, vale lo que responde la API.
    const body = {
      id: 'w1',
      event: 'order_status_updated',
      orderId: 'g-1',
      orderReferenceId: 'o-1',
      fulfillmentStatus: 'delivered',
    };
    expect(await provider.parseWebhook({ rawBody: JSON.stringify(body), headers: {} })).toEqual({
      type: 'status',
      eventId: 'g-1:shipped:1Z999',
      orderId: 'o-1',
      externalOrderId: 'g-1',
      status: 'shipped',
      trackingNumber: '1Z999',
      trackingUrl: 'https://ups.test/1Z999',
    });
    // Un pedido que no existe (o de otra referencia) no se acepta.
    const forged = { ...body, orderId: 'g-404' };
    await expect(
      provider.parseWebhook({ rawBody: JSON.stringify(forged), headers: {} }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
    const other = { ...body, orderReferenceId: 'o-2' };
    await expect(
      provider.parseWebhook({ rawBody: JSON.stringify(other), headers: {} }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it('tapa dura: pliego con vuelta; tapa blanda: con sangrado (y se guarda en caché)', async () => {
    const gelato = fakeGelato({
      [encodeURIComponent(GELATO_PRODUCTS.hardcover)]: () => ({
        json: {
          wraparoundInsideSize: { width: 478, height: 326, left: 0, top: 0 },
          spineSize: { width: 6, height: 286, left: 236, top: 20 },
          contentFrontSize: { width: 208, height: 286, left: 250, top: 20 },
        },
      }),
      [encodeURIComponent(GELATO_PRODUCTS.softcover)]: () => ({
        json: {
          bleedSize: { width: 428.72, height: 286, left: 0, top: 0 },
          spineSize: { width: 2.72, height: 280, left: 213, top: 3 },
          contentFrontSize: { width: 210, height: 280, left: 215.72, top: 3 },
        },
      }),
    });
    const provider = printer(gelato.fetchImpl);
    const hard = await provider.fileSpec({ format: 'hardcover', pageCount: 28, quantity: 1 });
    expect(hard).toEqual({
      packaging: 'single',
      cover: { widthMm: 478, heightMm: 326, spineLeftMm: 236, spineWidthMm: 6, edgeMm: 20 },
    });
    const soft = await provider.fileSpec({ format: 'softcover', pageCount: 28, quantity: 1 });
    expect(soft.cover).toEqual({
      widthMm: 428.72,
      heightMm: 286,
      spineLeftMm: 213,
      spineWidthMm: 2.72,
      edgeMm: 3,
    });
    await provider.fileSpec({ format: 'hardcover', pageCount: 28, quantity: 1 });
    expect(gelato.calls).toHaveLength(2);
  });

  it('el cuento grapado es un solo PDF A5 sin lomo y se completa a múltiplo de 4 con las tapas', async () => {
    const gelato = fakeGelato({});
    const provider = printer(gelato.fetchImpl);
    // Mini: 12 páginas interiores + 2 tapas = 14 → 16 en total (2 de relleno).
    const spec = await provider.fileSpec({ format: 'booklet', pageCount: 12, quantity: 1 });
    expect(spec).toEqual({
      packaging: 'booklet',
      trim: { widthMm: 148, heightMm: 210 },
      bleedMm: 3,
      minInteriorPages: 14,
    });
    // No necesita pedir la tapa a Gelato: no hay lomo.
    expect(gelato.calls).toHaveLength(0);
  });
});

describe('tarjetas 5×7"', () => {
  const ADDRESS = {
    name: 'Ana Pérez',
    line1: 'Av. Reforma 123',
    line2: null,
    city: 'CDMX',
    state: 'CDMX',
    postalCode: '06600',
    country: 'MX' as const,
    phone: '+52 55 1234 5678',
  };

  it('cotiza sin cantidad de páginas y usa el papel de EE. UU. solo allá', async () => {
    const gelato = fakeGelato({ 'orders:quote': () => ({ json: QUOTE }) });
    const provider = printer(gelato.fetchImpl);
    const items = [{ format: 'card' as const, piece: 'invitation', pageCount: 1, quantity: 30 }];
    await provider.quote(items, ADDRESS, 'USD');
    await provider.quote(items, { ...ADDRESS, country: 'US' }, 'USD');
    const [mx, us] = gelato.calls.map(
      (call) => (call.body as { products: Record<string, unknown>[] }).products[0],
    );
    expect(mx).toEqual({
      itemReferenceId: 'card-0',
      productUid: GELATO_PRODUCTS.card,
      quantity: 30,
    });
    expect(us?.productUid).toBe(GELATO_CARD_US);
  });
});
