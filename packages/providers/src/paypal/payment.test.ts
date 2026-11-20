import {
  PaymentDeclinedError,
  ProviderError,
  WebhookSignatureError,
  type CheckoutRequest,
} from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { PaypalPaymentProvider, paypalMinor } from './payment';

const NOW = new Date('2026-11-19T12:00:00Z');

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** Simula la API de PayPal: cada ruta responde lo que se le indique. */
interface Route {
  status?: number;
  body: unknown;
}

/** Cada ruta responde siempre lo mismo, o una lista en orden (la última se repite). */
function fakePaypal(routes: Record<string, Route | Route[]>) {
  const calls: Call[] = [];
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    if (path === '/v1/oauth2/token') {
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: 'tok', expires_in: 32400 }), { status: 200 }),
      );
    }
    const entry = routes[path];
    const route = Array.isArray(entry) ? (entry.length > 1 ? entry.shift() : entry[0]) : entry;
    if (!route) return Promise.resolve(new Response('not found', { status: 404 }));
    return Promise.resolve(
      new Response(JSON.stringify(route.body), { status: route.status ?? 200 }),
    );
  }) as typeof fetch;
  return { calls, fetchImpl };
}

/** Cuerpo enviado (siempre texto JSON en este proveedor). */
const order = (status: string, captures: unknown[] = []) => ({
  id: 'PP-ORDER-1',
  status,
  purchase_units: [{ payments: { captures } }],
});
const ORDER_PATH = '/v2/checkout/orders/PP-ORDER-1';
const CAPTURE_PATH = '/v2/checkout/orders/PP-ORDER-1/capture';

const bodyOf = (call: Call | undefined): string =>
  typeof call?.init?.body === 'string' ? call.init.body : '';

const provider = (fetchImpl: typeof fetch) =>
  new PaypalPaymentProvider({
    clientId: 'client',
    clientSecret: 'secret',
    webhookId: 'WH-1',
    environment: 'sandbox',
    fetchImpl,
    now: () => NOW,
  });

const checkoutRequest: CheckoutRequest = {
  orderId: 'ord_1',
  customerEmail: 'ana@example.com',
  currency: 'USD',
  locale: 'es',
  lineItems: [{ name: 'Ebook', amountMinor: 1599, quantity: 1 }],
  successUrl: 'https://staging.storynido.com/es/pedido/ord_1',
  cancelUrl: 'https://staging.storynido.com/es/crear/b1',
};

const signedHeaders = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT',
  'paypal-transmission-id': 'tx-1',
  'paypal-transmission-sig': 'sig',
  'paypal-transmission-time': NOW.toISOString(),
};

const verified = {
  '/v1/notifications/verify-webhook-signature': { body: { verification_status: 'SUCCESS' } },
};

const capture = (extra: Record<string, unknown> = {}) => ({
  id: 'CAP-1',
  status: 'COMPLETED',
  amount: { currency_code: 'USD', value: '15.99' },
  custom_id: 'ord_1',
  invoice_id: 'ord_1',
  supplementary_data: { related_ids: { order_id: 'PP-ORDER-1' } },
  ...extra,
});

describe('paypalMinor', () => {
  it('pasa el texto de PayPal a centavos', () => {
    expect(paypalMinor('15.99')).toBe(1599);
    expect(paypalMinor('20')).toBe(2000);
    expect(paypalMinor('0.5')).toBe(50);
    expect(paypalMinor('abc')).toBeNaN();
  });
});

describe('PaypalPaymentProvider.createCheckout', () => {
  it('crea la orden en USD con StoryNido como marca y devuelve el enlace de pago', async () => {
    const { calls, fetchImpl } = fakePaypal({
      '/v2/checkout/orders': {
        status: 201,
        body: {
          id: 'PP-ORDER-1',
          status: 'PAYER_ACTION_REQUIRED',
          links: [
            { rel: 'self', href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/PP-ORDER-1' },
            {
              rel: 'payer-action',
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=PP-ORDER-1',
            },
          ],
        },
      },
    });
    const session = await provider(fetchImpl).createCheckout(checkoutRequest);
    expect(session.id).toBe('PP-ORDER-1');
    expect(session.url).toBe('https://www.sandbox.paypal.com/checkoutnow?token=PP-ORDER-1');

    const create = calls.find((call) => call.url.endsWith('/v2/checkout/orders'));
    expect(create?.url.startsWith('https://api-m.sandbox.paypal.com')).toBe(true);
    const headers = create?.init?.headers as Record<string, string>;
    expect(headers['PayPal-Request-Id']).toBe('order-ord_1');
    expect(headers.Authorization).toBe('Bearer tok');
    const body = JSON.parse(bodyOf(create)) as {
      intent: string;
      purchase_units: { custom_id: string; amount: { value: string; currency_code: string } }[];
      payment_source?: unknown;
      application_context: { brand_name: string; locale: string; return_url: string };
    };
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units[0]?.custom_id).toBe('ord_1');
    expect(body.purchase_units[0]?.amount).toMatchObject({ currency_code: 'USD', value: '15.99' });
    // Sin payment_source: la misma orden sirve para el botón de PayPal y para el de tarjeta.
    expect(body.payment_source).toBeUndefined();
    expect(body.application_context).toMatchObject({
      brand_name: 'StoryNido',
      locale: 'es-MX',
      return_url: checkoutRequest.successUrl,
    });
  });

  it('rechaza otra moneda que no sea USD', async () => {
    const { fetchImpl } = fakePaypal({});
    await expect(
      provider(fetchImpl).createCheckout({ ...checkoutRequest, currency: 'ARS' }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('informa el error de PayPal', async () => {
    const { fetchImpl } = fakePaypal({
      '/v2/checkout/orders': { status: 400, body: { name: 'INVALID_REQUEST' } },
    });
    await expect(provider(fetchImpl).createCheckout(checkoutRequest)).rejects.toThrow(
      /crear la orden/,
    );
  });
});

describe('PaypalPaymentProvider.parseWebhook', () => {
  const event = (eventType: string, resource: unknown) =>
    JSON.stringify({ id: 'WH-EVT-1', event_type: eventType, resource });

  it('sin cabeceras de firma: rechaza', async () => {
    const { fetchImpl } = fakePaypal(verified);
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('PAYMENT.CAPTURE.COMPLETED', capture()),
        headers: {},
      }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it('firma que PayPal no reconoce: rechaza', async () => {
    const { fetchImpl } = fakePaypal({
      '/v1/notifications/verify-webhook-signature': {
        body: { verification_status: 'FAILURE' },
      },
    });
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('PAYMENT.CAPTURE.COMPLETED', capture()),
        headers: signedHeaders,
      }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it('manda el cuerpo crudo tal cual a la verificación', async () => {
    const { calls, fetchImpl } = fakePaypal(verified);
    const rawBody = event('PAYMENT.CAPTURE.COMPLETED', capture());
    await provider(fetchImpl).parseWebhook({ rawBody, headers: signedHeaders });
    const verify = calls.find((call) => call.url.endsWith('/verify-webhook-signature'));
    const sent = bodyOf(verify);
    expect(sent.endsWith(`"webhook_event":${rawBody}}`)).toBe(true);
    expect(JSON.parse(sent)).toMatchObject({ webhook_id: 'WH-1', transmission_id: 'tx-1' });
  });

  it('captura completada: pago confirmado con el monto en centavos', async () => {
    const { fetchImpl } = fakePaypal(verified);
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('PAYMENT.CAPTURE.COMPLETED', capture()),
        headers: signedHeaders,
      }),
    ).resolves.toEqual({
      type: 'checkout.completed',
      eventId: 'WH-EVT-1',
      orderId: 'ord_1',
      sessionId: 'PP-ORDER-1',
      paymentId: 'CAP-1',
      amountMinor: 1599,
      currency: 'USD',
      taxMinor: null,
    });
  });

  it('orden aprobada: la captura y confirma el pago', async () => {
    const { calls, fetchImpl } = fakePaypal({
      ...verified,
      [ORDER_PATH]: { body: order('APPROVED') },
      [CAPTURE_PATH]: { status: 201, body: order('COMPLETED', [capture()]) },
    });
    const result = await provider(fetchImpl).parseWebhook({
      rawBody: event('CHECKOUT.ORDER.APPROVED', {
        id: 'PP-ORDER-1',
        purchase_units: [{ custom_id: 'ord_1', reference_id: 'ord_1' }],
      }),
      headers: signedHeaders,
    });
    expect(result).toMatchObject({
      type: 'checkout.completed',
      orderId: 'ord_1',
      sessionId: 'PP-ORDER-1',
      paymentId: 'CAP-1',
      amountMinor: 1599,
    });
    const captureCall = calls.find((call) => call.url.endsWith('/capture'));
    // Solo se cobra una orden aprobada, así que la clave de idempotencia es segura.
    expect((captureCall?.init?.headers as Record<string, string>)['PayPal-Request-Id']).toBe(
      'capture-PP-ORDER-1',
    );
  });

  it('orden ya cobrada: usa su captura sin volver a cobrar (sin 422 en PayPal)', async () => {
    const { calls, fetchImpl } = fakePaypal({
      ...verified,
      [ORDER_PATH]: { body: order('COMPLETED', [capture()]) },
    });
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('CHECKOUT.ORDER.APPROVED', {
          id: 'PP-ORDER-1',
          purchase_units: [{ custom_id: 'ord_1' }],
        }),
        headers: signedHeaders,
      }),
    ).resolves.toMatchObject({ type: 'checkout.completed', paymentId: 'CAP-1' });
    expect(calls.some((call) => call.url.endsWith('/capture'))).toBe(false);
  });

  it('carrera: si otro cobro ganó (422), lee la captura de la orden', async () => {
    const { fetchImpl } = fakePaypal({
      ...verified,
      [ORDER_PATH]: [{ body: order('APPROVED') }, { body: order('COMPLETED', [capture()]) }],
      [CAPTURE_PATH]: { status: 422, body: { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] } },
    });
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('CHECKOUT.ORDER.APPROVED', {
          id: 'PP-ORDER-1',
          purchase_units: [{ custom_id: 'ord_1' }],
        }),
        headers: signedHeaders,
      }),
    ).resolves.toMatchObject({ type: 'checkout.completed', paymentId: 'CAP-1' });
  });

  it('tarjeta rechazada al cobrar: el aviso se acepta (no se reintenta) y no hay pago', async () => {
    const { fetchImpl } = fakePaypal({
      ...verified,
      '/v2/checkout/orders/PP-ORDER-1': {
        body: { id: 'PP-ORDER-1', status: 'APPROVED', purchase_units: [{}] },
      },
      '/v2/checkout/orders/PP-ORDER-1/capture': {
        status: 422,
        body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }] },
      },
    });
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('CHECKOUT.ORDER.APPROVED', {
          id: 'PP-ORDER-1',
          purchase_units: [{ custom_id: 'ord_1' }],
        }),
        headers: signedHeaders,
      }),
    ).resolves.toMatchObject({ type: 'ignored' });
  });

  it('captura pendiente (revisión de PayPal): todavía no es pago', async () => {
    const { fetchImpl } = fakePaypal({
      ...verified,
      [ORDER_PATH]: { body: order('APPROVED') },
      [CAPTURE_PATH]: {
        status: 201,
        body: order('COMPLETED', [capture({ status: 'PENDING' })]),
      },
    });
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('CHECKOUT.ORDER.APPROVED', {
          id: 'PP-ORDER-1',
          purchase_units: [{ custom_id: 'ord_1' }],
        }),
        headers: signedHeaders,
      }),
    ).resolves.toMatchObject({ type: 'ignored' });
  });

  it('reembolso: lo asocia a la captura por el enlace "up"', async () => {
    const { fetchImpl } = fakePaypal(verified);
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('PAYMENT.CAPTURE.REFUNDED', {
          id: 'REF-1',
          amount: { currency_code: 'USD', value: '15.99' },
          links: [
            { rel: 'self', href: 'https://api-m.sandbox.paypal.com/v2/payments/refunds/REF-1' },
            { rel: 'up', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAP-1' },
          ],
        }),
        headers: signedHeaders,
      }),
    ).resolves.toEqual({
      type: 'refund.succeeded',
      eventId: 'WH-EVT-1',
      paymentId: 'CAP-1',
      amountMinor: 1599,
    });
  });

  it('disputa: abre el aviso con la captura y el monto', async () => {
    const { fetchImpl } = fakePaypal(verified);
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('CUSTOMER.DISPUTE.CREATED', {
          dispute_id: 'PP-D-1',
          dispute_amount: { currency_code: 'USD', value: '15.99' },
          disputed_transactions: [{ seller_transaction_id: 'CAP-1' }],
        }),
        headers: signedHeaders,
      }),
    ).resolves.toEqual({
      type: 'dispute.opened',
      eventId: 'WH-EVT-1',
      paymentId: 'CAP-1',
      amountMinor: 1599,
    });
  });

  it('otros eventos: se ignoran', async () => {
    const { fetchImpl } = fakePaypal(verified);
    await expect(
      provider(fetchImpl).parseWebhook({
        rawBody: event('PAYMENT.CAPTURE.DENIED', capture()),
        headers: signedHeaders,
      }),
    ).resolves.toMatchObject({ type: 'ignored', rawType: 'PAYMENT.CAPTURE.DENIED' });
  });
});

describe('PaypalPaymentProvider.confirm', () => {
  it('tarjeta rechazada al cobrar: avisa que se rechazó, no es una falla del cobrador', async () => {
    const { fetchImpl } = fakePaypal({
      '/v2/checkout/orders/PP-ORDER-1': {
        body: { id: 'PP-ORDER-1', status: 'APPROVED', purchase_units: [{}] },
      },
      '/v2/checkout/orders/PP-ORDER-1/capture': {
        status: 422,
        body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }] },
      },
    });
    await expect(provider(fetchImpl).confirm('PP-ORDER-1', 'ord_1')).rejects.toBeInstanceOf(
      PaymentDeclinedError,
    );
  });

  it('aprobada en la página: la cobra y confirma el pago', async () => {
    const { fetchImpl } = fakePaypal({
      [ORDER_PATH]: { body: order('APPROVED') },
      [CAPTURE_PATH]: { status: 201, body: order('COMPLETED', [capture()]) },
    });
    await expect(provider(fetchImpl).confirm('PP-ORDER-1', 'ord_1')).resolves.toMatchObject({
      type: 'checkout.completed',
      eventId: 'confirm-CAP-1',
      orderId: 'ord_1',
      sessionId: 'PP-ORDER-1',
      paymentId: 'CAP-1',
      amountMinor: 1599,
    });
  });

  it('ya cobrada por el webhook: usa la captura de la orden sin volver a cobrar', async () => {
    const { calls, fetchImpl } = fakePaypal({
      [ORDER_PATH]: { body: order('COMPLETED', [capture()]) },
    });
    await expect(provider(fetchImpl).confirm('PP-ORDER-1', 'ord_1')).resolves.toMatchObject({
      type: 'checkout.completed',
      paymentId: 'CAP-1',
    });
    expect(calls.some((call) => call.url.endsWith('/capture'))).toBe(false);
  });

  it('todavía sin aprobar: no intenta cobrar (sin 422 en PayPal)', async () => {
    const { calls, fetchImpl } = fakePaypal({
      [ORDER_PATH]: { body: order('CREATED') },
    });
    await expect(provider(fetchImpl).confirm('PP-ORDER-1', 'ord_1')).resolves.toBeNull();
    expect(calls.some((call) => call.url.endsWith('/capture'))).toBe(false);
  });
});

describe('PaypalPaymentProvider.refund', () => {
  it('reembolsa la captura (parcial) con clave de idempotencia', async () => {
    const { calls, fetchImpl } = fakePaypal({
      '/v2/payments/captures/CAP-1/refund': {
        status: 201,
        body: { id: 'REF-1', status: 'COMPLETED' },
      },
    });
    await expect(
      provider(fetchImpl).refund({
        paymentId: 'CAP-1',
        amountMinor: 500,
        reason: 'parcial',
        idempotencyKey: 'ref-ord_1',
      }),
    ).resolves.toEqual({ refundId: 'REF-1', status: 'succeeded' });
    const call = calls.find((c) => c.url.endsWith('/refund'));
    expect((call?.init?.headers as Record<string, string>)['PayPal-Request-Id']).toBe('ref-ord_1');
    expect(JSON.parse(bodyOf(call))).toEqual({
      amount: { currency_code: 'USD', value: '5.00' },
    });
  });

  it('reembolso total: sin monto', async () => {
    const { calls, fetchImpl } = fakePaypal({
      '/v2/payments/captures/CAP-1/refund': {
        status: 201,
        body: { id: 'REF-2', status: 'PENDING' },
      },
    });
    await expect(
      provider(fetchImpl).refund({
        paymentId: 'CAP-1',
        amountMinor: null,
        reason: 'total',
        idempotencyKey: 'ref-2',
      }),
    ).resolves.toEqual({ refundId: 'REF-2', status: 'pending' });
    const call = calls.find((c) => c.url.endsWith('/refund'));
    expect(JSON.parse(bodyOf(call))).toEqual({});
  });
});

describe('PayPal: comisión real y lectura de la billetera', () => {
  it('la captura trae comisión y neto: el evento los lleva', async () => {
    const { fetchImpl } = fakePaypal(verified);
    const rawBody = JSON.stringify({
      id: 'WH-EVT-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: capture({
        seller_receivable_breakdown: {
          gross_amount: { currency_code: 'USD', value: '15.99' },
          paypal_fee: { currency_code: 'USD', value: '1.16' },
          net_amount: { currency_code: 'USD', value: '14.83' },
        },
      }),
    });
    const result = await provider(fetchImpl).parseWebhook({
      rawBody,
      headers: signedHeaders,
    });
    expect(result).toMatchObject({ type: 'checkout.completed', feeMinor: 116, netMinor: 1483 });
  });

  it('saldo: total, disponible y retenido en centavos', async () => {
    const { calls, fetchImpl } = fakePaypal({
      '/v1/reporting/balances': {
        body: {
          balances: [
            {
              currency: 'USD',
              total_balance: { currency_code: 'USD', value: '120.50' },
              available_balance: { currency_code: 'USD', value: '100.00' },
              withheld_balance: { currency_code: 'USD', value: '20.50' },
            },
          ],
        },
      },
    });
    const balances = await provider(fetchImpl).reporting.balances();
    expect(balances).toEqual([
      { currency: 'USD', totalMinor: 12050, availableMinor: 10000, withheldMinor: 2050 },
    ]);
    expect(
      calls.every(
        (call) => !call.init?.method || call.init.method === 'GET' || call.url.includes('oauth2'),
      ),
    ).toBe(true);
  });

  it('movimientos: tipos, importes con signo, pedido y paginado', async () => {
    const info = (id: string, code: string, gross: string, fee: string, custom?: string) => ({
      transaction_info: {
        transaction_id: id,
        transaction_event_code: code,
        transaction_initiation_date: '2026-11-19T10:00:00+0000',
        transaction_amount: { currency_code: 'USD', value: gross },
        fee_amount: { currency_code: 'USD', value: fee },
        transaction_status: 'S',
        custom_field: custom,
      },
    });
    const { fetchImpl } = fakePaypal({
      '/v1/reporting/transactions': [
        {
          body: {
            total_pages: 2,
            transaction_details: [
              info('CAP-1', 'T0006', '15.99', '-1.16', 'ord_1'),
              info('REF-1', 'T1107', '-15.99', '1.16', 'ord_1'),
            ],
          },
        },
        {
          body: { total_pages: 2, transaction_details: [info('WD-1', 'T0400', '-50.00', '0.00')] },
        },
      ],
    });
    const list = await provider(fetchImpl).reporting.transactions(
      new Date('2026-11-01T00:00:00Z'),
      NOW,
    );
    expect(list.map((tx) => [tx.id, tx.kind, tx.grossMinor, tx.feeMinor, tx.orderId])).toEqual([
      ['CAP-1', 'payment', 1599, -116, 'ord_1'],
      ['REF-1', 'refund', -1599, 116, 'ord_1'],
      ['WD-1', 'withdrawal', -5000, 0, null],
    ]);
  });

  it('permiso faltante: el error dice HTTP 403 para que el admin lo explique', async () => {
    const { fetchImpl } = fakePaypal({
      '/v1/reporting/transactions': { status: 403, body: { name: 'NOT_AUTHORIZED' } },
    });
    await expect(
      provider(fetchImpl).reporting.transactions(new Date('2026-11-01T00:00:00Z'), NOW),
    ).rejects.toThrow(/403/);
  });

  it('403 al leer: pide un token nuevo y reintenta una vez', async () => {
    const calls: string[] = [];
    let reads = 0;
    let tokens = 0;
    const fetchImpl = ((url: string) => {
      const path = new URL(url).pathname;
      calls.push(path);
      if (path === '/v1/oauth2/token') {
        tokens += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: `tok${String(tokens)}`, expires_in: 32400 })),
        );
      }
      reads += 1;
      return Promise.resolve(
        reads === 1
          ? new Response(JSON.stringify({ name: 'NOT_AUTHORIZED' }), { status: 403 })
          : new Response(JSON.stringify({ balances: [] })),
      );
    }) as typeof fetch;
    await expect(provider(fetchImpl).reporting.balances()).resolves.toEqual([]);
    expect(tokens).toBe(2);
  });

  it('disputas: monto y cobro disputado', async () => {
    const { fetchImpl } = fakePaypal({
      '/v1/customer/disputes': {
        body: {
          items: [
            {
              dispute_id: 'PP-D-1',
              status: 'OPEN',
              reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
              create_time: '2026-11-19T10:00:00.000Z',
              dispute_amount: { currency_code: 'USD', value: '15.99' },
              disputed_transactions: [{ seller_transaction_id: 'CAP-1' }],
            },
          ],
        },
      },
    });
    const [dispute] = await provider(fetchImpl).reporting.disputes();
    expect(dispute).toMatchObject({ id: 'PP-D-1', amountMinor: 1599, paymentId: 'CAP-1' });
  });
});
