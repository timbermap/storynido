import { ProviderError, WebhookSignatureError, type CheckoutRequest } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { GumroadPaymentProvider, signGumroadPing } from './payment';

const SECRET = 'secreto-de-prueba-gumroad';
const NOW = new Date('2026-11-18T12:00:00Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);
const PRODUCT_URL = 'https://storynidoar.gumroad.com/l/cjlkhc';

function fake(response: unknown, status = 200) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(response), { status }));
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const provider = (
  options: { fetchImpl?: typeof fetch; acceptTestSales?: boolean } = {},
): GumroadPaymentProvider =>
  new GumroadPaymentProvider({
    productUrl: PRODUCT_URL,
    accessToken: 'token_de_prueba',
    pingSecret: SECRET,
    acceptTestSales: options.acceptTestSales ?? false,
    fetchImpl: options.fetchImpl ?? fake({}).fetchImpl,
    now: () => NOW,
  });

const checkoutRequest: CheckoutRequest = {
  orderId: 'ord_1',
  customerEmail: 'ana@example.com',
  currency: 'USD',
  locale: 'es',
  lineItems: [{ name: 'Mini cuento', amountMinor: 1399, quantity: 1 }],
  successUrl: 'https://staging.storynido.com/es/pedido/ord_1',
  cancelUrl: 'https://staging.storynido.com/es/crear/b1',
};

/** Ping como lo manda Gumroad: form-encoded y firmado. */
function ping(fields: Record<string, string>, timestamp = NOW_SECONDS) {
  const rawBody = new URLSearchParams(fields).toString();
  return {
    rawBody,
    headers: { 'x-gumroad-signature': signGumroadPing(SECRET, timestamp, rawBody) },
  };
}

const sale = (extra: Record<string, string> = {}) => ({
  sale_id: 'FO8TXN-dIxYMLT4yZpAyQw==',
  product_permalink: PRODUCT_URL,
  email: 'ana@example.com',
  price: '1399',
  gumroad_fee: '220',
  currency: 'usd',
  quantity: '1',
  'url_params[order_id]': 'ord_1',
  refunded: 'false',
  disputed: 'false',
  resource_name: 'sale',
  ...extra,
});

describe('Gumroad', () => {
  it('arma la URL del producto con el total, wanted y el order_id (sin el mail)', async () => {
    const session = await provider().createCheckout({
      ...checkoutRequest,
      lineItems: [
        { name: 'Libro', amountMinor: 1500, quantity: 1 },
        { name: 'Extra', amountMinor: 250, quantity: 2 },
      ],
    });
    const url = new URL(session.url);
    expect(`${url.origin}${url.pathname}`).toBe(PRODUCT_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      wanted: 'true',
      price: '20.00',
      order_id: 'ord_1',
    });
    expect(session.id).toBe('ord_1');
    expect(session.expiresAt).toEqual(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
  });

  it('rechaza monedas que no sean USD', async () => {
    await expect(
      provider().createCheckout({ ...checkoutRequest, currency: 'MXN' }),
    ).rejects.toThrow(/solo cobra en USD/);
  });

  it('acepta un ping firmado y traduce la venta', () => {
    expect(provider().parseWebhook(ping(sale()))).toEqual({
      type: 'checkout.completed',
      eventId: 'FO8TXN-dIxYMLT4yZpAyQw==:sale',
      orderId: 'ord_1',
      sessionId: 'ord_1',
      paymentId: 'FO8TXN-dIxYMLT4yZpAyQw==',
      amountMinor: 1399,
      currency: 'USD',
      taxMinor: null,
    });
  });

  it('rechaza firma inválida, cuerpo alterado, sin firma o timestamp viejo', () => {
    const input = ping(sale());
    expect(() =>
      provider().parseWebhook({ ...input, rawBody: input.rawBody.replace('1399', '100') }),
    ).toThrow(WebhookSignatureError);
    expect(() =>
      provider().parseWebhook({
        ...input,
        headers: { 'x-gumroad-signature': `t=${String(NOW_SECONDS)},v1=abc` },
      }),
    ).toThrow(WebhookSignatureError);
    expect(() => provider().parseWebhook({ rawBody: input.rawBody, headers: {} })).toThrow(
      WebhookSignatureError,
    );
    expect(() => provider().parseWebhook(ping(sale(), NOW_SECONDS - 301))).toThrow(
      WebhookSignatureError,
    );
  });

  it('una venta de prueba solo cuenta si el ambiente la acepta (staging)', () => {
    const test = ping(sale({ test: 'true' }));
    expect(provider().parseWebhook(test).type).toBe('ignored');
    expect(provider({ acceptTestSales: true }).parseWebhook(test).type).toBe('checkout.completed');
  });

  it('ignora ventas sin order_id o ya reembolsadas', () => {
    const { 'url_params[order_id]': _omit, ...withoutOrder } = sale();
    expect(provider().parseWebhook(ping(withoutOrder)).type).toBe('ignored');
    expect(provider().parseWebhook(ping(sale({ refunded: 'true' }))).type).toBe('ignored');
  });

  it('traduce reembolsos y disputas; el resto se ignora', () => {
    expect(
      provider().parseWebhook(ping(sale({ resource_name: 'refund', refunded: 'true' }))),
    ).toEqual({
      type: 'refund.succeeded',
      eventId: 'FO8TXN-dIxYMLT4yZpAyQw==:refund',
      paymentId: 'FO8TXN-dIxYMLT4yZpAyQw==',
      amountMinor: 1399,
    });
    expect(provider().parseWebhook(ping(sale({ resource_name: 'dispute' })))).toEqual({
      type: 'dispute.opened',
      eventId: 'FO8TXN-dIxYMLT4yZpAyQw==:dispute',
      paymentId: 'FO8TXN-dIxYMLT4yZpAyQw==',
      amountMinor: 1399,
    });
    expect(provider().parseWebhook(ping(sale({ resource_name: 'dispute_won' })))).toEqual({
      type: 'ignored',
      eventId: 'FO8TXN-dIxYMLT4yZpAyQw==:dispute_won',
      rawType: 'dispute_won',
    });
  });

  it('reembolsa total o parcial con la API v2', async () => {
    const api = fake({ success: true, sale: { id: 'FO8TXN' } });
    const gumroad = provider({ fetchImpl: api.fetchImpl });
    expect(
      await gumroad.refund({
        paymentId: 'FO8TXN',
        amountMinor: null,
        reason: 'pedido duplicado',
        idempotencyKey: 'refund:ord_1',
      }),
    ).toEqual({ refundId: 'FO8TXN', status: 'succeeded' });
    expect(api.calls[0]?.url).toBe('https://api.gumroad.com/v2/sales/FO8TXN/refund');
    expect(api.calls[0]?.init?.method).toBe('PUT');
    expect(api.calls[0]?.init?.body as string).toBe('access_token=token_de_prueba');
    await gumroad.refund({
      paymentId: 'FO8TXN',
      amountMinor: 500,
      reason: 'parcial',
      idempotencyKey: 'refund:ord_2',
    });
    expect(api.calls[1]?.init?.body as string).toBe(
      'access_token=token_de_prueba&amount_cents=500',
    );
  });

  it('un reembolso rechazado es ProviderError; un 5xx se puede reintentar', async () => {
    const rejected = (await provider({
      fetchImpl: fake({ success: false, message: 'Purchase is already refunded.' }, 404).fetchImpl,
    })
      .refund({ paymentId: 'x', amountMinor: null, reason: 'r', idempotencyKey: 'k' })
      .catch((reason: unknown) => reason)) as ProviderError;
    expect(rejected).toBeInstanceOf(ProviderError);
    expect(rejected.message).toContain('already refunded');
    expect(rejected.retryable).toBe(false);
    const down = (await provider({ fetchImpl: fake({}, 503).fetchImpl })
      .refund({ paymentId: 'x', amountMinor: null, reason: 'r', idempotencyKey: 'k' })
      .catch((reason: unknown) => reason)) as ProviderError;
    expect(down.retryable).toBe(true);
  });
});
