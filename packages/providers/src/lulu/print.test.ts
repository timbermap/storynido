import { LULU_PRODUCTS, ProviderError, WebhookSignatureError } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { LuluPrintProvider, luluPageCount } from './print';

const address = {
  name: 'Ana Pérez',
  line1: '100 Congress Ave',
  line2: null,
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  country: 'US' as const,
  phone: '+15125550100',
};

type Route = (
  body: Record<string, unknown> | null,
  method: string,
) => { status?: number; json: unknown };

/** Lulu de mentira: responde según "MÉTODO ruta" (sin la query) y guarda cada llamada. */
function fake(routes: Record<string, Route>) {
  const calls: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const method = init?.method ?? 'GET';
    if (url.pathname.endsWith('/openid-connect/token')) {
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 }),
      );
    }
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null;
    calls.push({ method, path: `${url.pathname}${url.search}`, body });
    const reply = routes[`${method} ${url.pathname}`]?.(body, method) ?? { status: 404, json: {} };
    return Promise.resolve(
      new Response(JSON.stringify(reply.json), { status: reply.status ?? 200 }),
    );
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const cost = (total: string, shipping: string) => ({
  total_cost_incl_tax: total,
  shipping_cost: { total_cost_excl_tax: shipping },
});

const provider = (fetchImpl: typeof fetch) =>
  new LuluPrintProvider({ clientKey: 'k', clientSecret: 's', sandbox: true, fetchImpl });

describe('Lulu', () => {
  it('completa al mínimo de páginas y siempre pares', () => {
    expect(luluPageCount('softcover', 28)).toBe(32);
    expect(luluPageCount('softcover', 33)).toBe(34);
    expect(luluPageCount('hardcover', 28)).toBe(28);
    expect(luluPageCount('hardcover', 20)).toBe(24);
  });

  it('cotiza con el envío más barato (impuesto incluido) y 32 páginas en tapa blanda', async () => {
    const api = fake({
      'POST /print-job-cost-calculations/': (body) =>
        body?.shipping_option === 'MAIL'
          ? { status: 201, json: cost('11.28', '5.69') }
          : { status: 201, json: cost('20.33', '14.74') },
    });
    const quote = await provider(api.fetchImpl).quote(
      [{ format: 'softcover', pageCount: 28, quantity: 1 }],
      address,
      'USD',
    );
    expect(quote).toMatchObject({
      shippingMinor: 569,
      productionCostUsdMinor: 559,
      totalCostUsdMinor: 1128,
      etaDaysMin: 8,
    });
    expect(api.calls[0]?.body).toMatchObject({
      line_items: [{ page_count: 32, pod_package_id: LULU_PRODUCTS.softcover, quantity: 1 }],
      shipping_address: { country_code: 'US', state_code: 'TX', phone_number: '+15125550100' },
    });
  });

  it('sin envío posible al destino, error no reintentable (gana otra imprenta)', async () => {
    const api = fake({
      'POST /print-job-cost-calculations/': () => ({
        status: 400,
        json: { shipping_address: 'recipient_tax_id is required' },
      }),
    });
    const error = await provider(api.fetchImpl)
      .quote(
        [{ format: 'softcover', pageCount: 28, quantity: 1 }],
        { ...address, country: 'MX' },
        'USD',
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).retryable).toBe(false);
  });

  it('crea el trabajo una sola vez (idempotente por nuestro pedido) con tapa y tripa', async () => {
    let created = 0;
    const api = fake({
      'GET /print-jobs/': () => ({
        json: {
          results: created > 0 ? [{ id: 77, external_id: 'o1', status: { name: 'CREATED' } }] : [],
        },
      }),
      'POST /print-job-cost-calculations/': () => ({ status: 201, json: cost('11.28', '5.69') }),
      'POST /print-jobs/': () => {
        created += 1;
        return { status: 201, json: { id: 77, external_id: 'o1', status: { name: 'CREATED' } } };
      },
    });
    const request = {
      orderId: 'o1',
      email: 'ana@example.com',
      currency: 'USD' as const,
      address,
      items: [
        {
          format: 'softcover' as const,
          pageCount: 28,
          quantity: 1,
          interiorPdfUrl: 'https://files/interior.pdf',
          coverPdfUrl: 'https://files/cover.pdf',
          bookPdfUrl: null,
        },
      ],
    };
    const lulu = provider(api.fetchImpl);
    expect(await lulu.createOrder(request)).toEqual({ externalOrderId: '77', status: 'received' });
    expect(await lulu.createOrder(request)).toEqual({ externalOrderId: '77', status: 'received' });
    expect(created).toBe(1);
    const post = api.calls.find((call) => call.method === 'POST' && call.path === '/print-jobs/');
    expect(post?.body).toMatchObject({
      external_id: 'o1',
      shipping_level: 'MAIL',
      line_items: [
        {
          printable_normalization: {
            pod_package_id: LULU_PRODUCTS.softcover,
            cover: { source_url: 'https://files/cover.pdf' },
            interior: { source_url: 'https://files/interior.pdf' },
          },
        },
      ],
    });
  });

  it('sin teléfono no crea el trabajo', async () => {
    const api = fake({ 'GET /print-jobs/': () => ({ json: { results: [] } }) });
    await expect(
      provider(api.fetchImpl).createOrder({
        orderId: 'o2',
        email: 'ana@example.com',
        currency: 'USD',
        address: { ...address, phone: null },
        items: [],
      }),
    ).rejects.toThrow(/teléfono/);
  });

  it('el aviso se verifica consultando el trabajo: despacho con seguimiento', async () => {
    const api = fake({
      'GET /print-jobs/77/': () => ({
        json: {
          id: 77,
          external_id: 'o1',
          status: { name: 'SHIPPED' },
          line_items: [{ tracking_id: '1Z999', tracking_urls: ['https://ups.test/1Z999'] }],
        },
      }),
    });
    const event = await provider(api.fetchImpl).parseWebhook({
      rawBody: JSON.stringify({
        topic: 'PRINT_JOB_STATUS_CHANGED',
        data: { id: 77, status: { name: 'CREATED' } },
      }),
      headers: {},
    });
    expect(event).toEqual({
      type: 'status',
      eventId: '77:shipped:1Z999',
      orderId: 'o1',
      externalOrderId: '77',
      status: 'shipped',
      trackingNumber: '1Z999',
      trackingUrl: 'https://ups.test/1Z999',
    });
  });

  it('un aviso de un trabajo que no existe se rechaza; los estados previos se ignoran', async () => {
    const api = fake({
      'GET /print-jobs/404/': () => ({ status: 404, json: {} }),
      'GET /print-jobs/5/': () => ({
        json: { id: 5, external_id: 'o5', status: { name: 'PRODUCTION_READY' } },
      }),
    });
    const lulu = provider(api.fetchImpl);
    await expect(
      lulu.parseWebhook({
        rawBody: JSON.stringify({ topic: 'PRINT_JOB_STATUS_CHANGED', data: { id: 404 } }),
        headers: {},
      }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
    expect(
      await lulu.parseWebhook({
        rawBody: JSON.stringify({ topic: 'PRINT_JOB_STATUS_CHANGED', data: { id: 5 } }),
        headers: {},
      }),
    ).toMatchObject({ type: 'ignored' });
  });

  it('tapa: medidas de Lulu (lomo y sangrado), 1/8" de sangrado interior y el mínimo de páginas', async () => {
    const api = fake({
      'POST /cover-dimensions/': () => ({
        status: 201,
        json: { width: '441.500', height: '285.750' },
      }),
    });
    const spec = await provider(api.fetchImpl).fileSpec({
      format: 'softcover',
      pageCount: 28,
      quantity: 1,
    });
    expect(spec).toEqual({
      packaging: 'separate',
      trim: { widthMm: 215.9, heightMm: 279.4 },
      bleedMm: 3.175,
      minInteriorPages: 32,
      cover: {
        widthMm: 441.5,
        heightMm: 285.75,
        spineLeftMm: 219.08,
        spineWidthMm: 3.35,
        edgeMm: 3.18,
      },
    });
    expect(api.calls[0]?.body).toEqual({
      pod_package_id: LULU_PRODUCTS.softcover,
      interior_page_count: 32,
      unit: 'mm',
    });
  });
});
