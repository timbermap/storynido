import { ProviderError, WebhookSignatureError, type CheckoutRequest } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { DodoPaymentProvider, signDodoWebhook } from './payment';

const SECRET = `whsec_${Buffer.from('secreto-de-prueba-dodo').toString('base64')}`;
const NOW = new Date('2026-11-17T12:00:00Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

function fake(response: unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] =
    [];
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({
      url,
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(init?.body as string) as Record<string, unknown>,
    });
    return Promise.resolve(new Response(JSON.stringify(response), { status }));
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const provider = (fetchImpl: typeof fetch = fake({}).fetchImpl, environment?: 'live_mode') =>
  new DodoPaymentProvider({
    apiKey: 'dodo_test_key',
    webhookSecret: SECRET,
    productId: 'pdt_test',
    environment,
    fetchImpl,
    now: () => NOW,
  });

const checkoutRequest: CheckoutRequest = {
  orderId: 'ord_1',
  customerEmail: 'ana@example.com',
  currency: 'USD',
  locale: 'es',
  lineItems: [{ name: 'Mini cuento', amountMinor: 1999, quantity: 1 }],
  successUrl: 'https://storynido.com/es/pedido/ord_1',
  cancelUrl: 'https://storynido.com/es/crear/b1',
};

function webhook(payload: unknown, options: { id?: string; timestamp?: number } = {}) {
  const rawBody = JSON.stringify(payload);
  const id = options.id ?? 'msg_1';
  const timestamp = options.timestamp ?? NOW_SECONDS;
  return {
    rawBody,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signDodoWebhook(SECRET, { id, timestamp, rawBody }),
    },
  };
}

const payment = (type: string, data: Record<string, unknown> = {}) => ({
  business_id: 'bus_1',
  type,
  timestamp: NOW.toISOString(),
  data: {
    payload_type: 'Payment',
    payment_id: 'pay_1',
    total_amount: 1999,
    currency: 'USD',
    checkout_session_id: 'cks_1',
    metadata: { orderId: 'ord_1' },
    ...data,
  },
});

describe('Dodo Payments', () => {
  it('crea el checkout con un solo ítem y el total del servidor', async () => {
    const api = fake({
      session_id: 'cks_1',
      checkout_url: 'https://test.checkout.dodopayments.com/cks_1',
    });
    const session = await provider(api.fetchImpl).createCheckout({
      ...checkoutRequest,
      lineItems: [
        { name: 'Libro', amountMinor: 1500, quantity: 1 },
        { name: 'Extra', amountMinor: 250, quantity: 2 },
      ],
    });
    expect(session).toEqual({
      id: 'cks_1',
      url: 'https://test.checkout.dodopayments.com/cks_1',
      expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });
    const call = api.calls[0];
    expect(call?.url).toBe('https://test.dodopayments.com/checkouts');
    expect(call?.headers.Authorization).toBe('Bearer dodo_test_key');
    expect(call?.body).toEqual({
      product_cart: [{ product_id: 'pdt_test', quantity: 1, amount: 2000 }],
      customer: { email: 'ana@example.com' },
      return_url: checkoutRequest.successUrl,
      cancel_url: checkoutRequest.cancelUrl,
      metadata: { orderId: 'ord_1' },
    });
  });

  it('sin email no manda cliente; en live usa la URL de producción', async () => {
    const api = fake({ session_id: 'cks_2', checkout_url: 'https://checkout.dodopayments.com/x' });
    await provider(api.fetchImpl, 'live_mode').createCheckout({
      ...checkoutRequest,
      customerEmail: null,
    });
    expect(api.calls[0]?.url).toBe('https://live.dodopayments.com/checkouts');
    expect(api.calls[0]?.body).not.toHaveProperty('customer');
  });

  it('rechaza monedas que no sean USD sin llamar a Dodo', async () => {
    const api = fake({});
    await expect(
      provider(api.fetchImpl).createCheckout({ ...checkoutRequest, currency: 'MXN' }),
    ).rejects.toThrow(/solo cobra en USD/);
    expect(api.calls).toHaveLength(0);
  });

  it('un error de Dodo es ProviderError; un 5xx se puede reintentar', async () => {
    const error = (await provider(fake({ message: 'caído' }, 503).fetchImpl)
      .createCheckout(checkoutRequest)
      .catch((reason: unknown) => reason)) as ProviderError;
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.retryable).toBe(true);
  });

  it('acepta una firma válida y traduce payment.succeeded', () => {
    expect(provider().parseWebhook(webhook(payment('payment.succeeded')))).toEqual({
      type: 'checkout.completed',
      eventId: 'msg_1',
      orderId: 'ord_1',
      sessionId: 'cks_1',
      paymentId: 'pay_1',
      amountMinor: 1999,
      currency: 'USD',
    });
  });

  it('acepta la firma correcta entre varias (rotación de secretos)', () => {
    const input = webhook(payment('payment.succeeded'));
    input.headers['webhook-signature'] = `v1,AAAA ${input.headers['webhook-signature']}`;
    expect(provider().parseWebhook(input).type).toBe('checkout.completed');
  });

  it('rechaza una firma inválida o un cuerpo alterado', () => {
    const input = webhook(payment('payment.succeeded'));
    expect(() =>
      provider().parseWebhook({ ...input, rawBody: input.rawBody.replace('1999', '1') }),
    ).toThrow(WebhookSignatureError);
    expect(() =>
      provider().parseWebhook({
        ...input,
        headers: { ...input.headers, 'webhook-signature': 'v1,Zm9v' },
      }),
    ).toThrow(WebhookSignatureError);
    expect(() => provider().parseWebhook({ rawBody: input.rawBody, headers: {} })).toThrow(
      WebhookSignatureError,
    );
  });

  it('rechaza un webhook con timestamp de más de 5 minutos', () => {
    const stale = webhook(payment('payment.succeeded'), { timestamp: NOW_SECONDS - 301 });
    expect(() => provider().parseWebhook(stale)).toThrow(WebhookSignatureError);
  });

  it('pago fallido o cancelado cierra el checkout', () => {
    for (const type of ['payment.failed', 'payment.cancelled']) {
      expect(provider().parseWebhook(webhook(payment(type)))).toEqual({
        type: 'checkout.expired',
        eventId: 'msg_1',
        orderId: 'ord_1',
        sessionId: 'cks_1',
      });
    }
  });

  it('traduce reembolsos y disputas; el resto se ignora', () => {
    expect(
      provider().parseWebhook(
        webhook({
          type: 'refund.succeeded',
          data: { payload_type: 'Refund', refund_id: 're_1', payment_id: 'pay_1', amount: 1999 },
        }),
      ),
    ).toEqual({
      type: 'refund.succeeded',
      eventId: 'msg_1',
      paymentId: 'pay_1',
      amountMinor: 1999,
    });
    expect(
      provider().parseWebhook(
        webhook({
          type: 'dispute.opened',
          data: {
            payload_type: 'Dispute',
            dispute_id: 'dp_1',
            payment_id: 'pay_1',
            amount: '1999',
          },
        }),
      ),
    ).toEqual({ type: 'dispute.opened', eventId: 'msg_1', paymentId: 'pay_1', amountMinor: 1999 });
    expect(provider().parseWebhook(webhook({ type: 'payment.processing', data: {} }))).toEqual({
      type: 'ignored',
      eventId: 'msg_1',
      rawType: 'payment.processing',
    });
  });

  it('un pago sin orderId en metadata se ignora (no es nuestro)', () => {
    expect(
      provider().parseWebhook(webhook(payment('payment.succeeded', { metadata: {} }))).type,
    ).toBe('ignored');
  });

  it('reembolsa total o parcial (por ítem) con clave idempotente', async () => {
    const api = fake({ refund_id: 're_1', status: 'pending' });
    const dodo = provider(api.fetchImpl);
    expect(
      await dodo.refund({
        paymentId: 'pay_1',
        amountMinor: null,
        reason: 'pedido duplicado',
        idempotencyKey: 'refund:ord_1',
      }),
    ).toEqual({ refundId: 're_1', status: 'pending' });
    expect(api.calls[0]?.url).toBe('https://test.dodopayments.com/refunds');
    expect(api.calls[0]?.headers['Idempotency-Key']).toBe('refund:ord_1');
    expect(api.calls[0]?.body).toEqual({
      payment_id: 'pay_1',
      reason: 'pedido duplicado',
      metadata: { idempotencyKey: 'refund:ord_1' },
    });
    await dodo.refund({
      paymentId: 'pay_1',
      amountMinor: 500,
      reason: 'parcial',
      idempotencyKey: 'refund:ord_2',
    });
    expect(api.calls[1]?.body.items).toEqual([{ item_id: 'pdt_test', amount: 500 }]);
  });
});
