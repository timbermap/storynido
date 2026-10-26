import {
  WebhookSignatureError,
  currencySchema,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type Refund,
  type RefundRequest,
  type WebhookInput,
} from '@storynido/shared';
import { z } from 'zod';

import { hmacHex, safeEqualHex, stableId } from '../crypto';

export const MOCK_PAYMENT_SIGNATURE_HEADER = 'x-mock-signature';

const webhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const completedSchema = z.object({
  orderId: z.string(),
  sessionId: z.string(),
  paymentId: z.string(),
  amountMinor: z.number().int().nonnegative(),
  currency: currencySchema,
});

/** Firma un evento como lo haría el proveedor simulado (para tests y simulaciones locales). */
export function signMockPaymentWebhook(
  secret: string,
  payload: z.input<typeof webhookSchema>,
): WebhookInput {
  const rawBody = JSON.stringify(payload);
  return { rawBody, headers: { [MOCK_PAYMENT_SIGNATURE_HEADER]: hmacHex(secret, rawBody) } };
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock';

  constructor(private readonly webhookSecret: string) {}

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.lineItems.length === 0) {
      return Promise.reject(new RangeError('El checkout necesita al menos un ítem'));
    }
    if (request.lineItems.some((item) => item.amountMinor < 0 || item.quantity < 1)) {
      return Promise.reject(new RangeError('Montos o cantidades inválidos'));
    }
    const id = stableId('mock_cs', request.orderId);
    const url = new URL(request.successUrl);
    url.searchParams.set('mock_session', id);
    return Promise.resolve({
      id,
      url: url.toString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  }

  parseWebhook(input: WebhookInput): PaymentEvent {
    const signature = input.headers[MOCK_PAYMENT_SIGNATURE_HEADER] ?? '';
    if (!safeEqualHex(signature, hmacHex(this.webhookSecret, input.rawBody))) {
      throw new WebhookSignatureError(this.id);
    }
    const event = webhookSchema.parse(JSON.parse(input.rawBody));
    switch (event.type) {
      case 'checkout.completed':
        return {
          type: 'checkout.completed',
          eventId: event.id,
          ...completedSchema.parse(event.data),
        };
      case 'checkout.expired': {
        const data = z.object({ orderId: z.string(), sessionId: z.string() }).parse(event.data);
        return { type: 'checkout.expired', eventId: event.id, ...data };
      }
      case 'refund.succeeded': {
        const data = z
          .object({ paymentId: z.string(), amountMinor: z.number().int() })
          .parse(event.data);
        return { type: 'refund.succeeded', eventId: event.id, ...data };
      }
      default:
        return { type: 'ignored', eventId: event.id, rawType: event.type };
    }
  }

  refund(request: RefundRequest): Promise<Refund> {
    return Promise.resolve({
      refundId: stableId('mock_re', request.idempotencyKey),
      status: 'succeeded',
    });
  }
}
