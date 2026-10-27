import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { CheckoutService } from '../checkout/service';
import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

type QuoteBody = z.output<(typeof apiRoutes)['checkoutQuote']['body']>;
type CheckoutBody = z.output<(typeof apiRoutes)['createCheckout']['body']>;

function user(request: FastifyRequest) {
  if (!request.user) throw new AppError(401, 'unauthorized', 'Inicia sesión.');
  return request.user;
}

export function registerCheckoutRoutes(app: FastifyInstance, checkout: CheckoutService): void {
  const { config } = app.deps;

  /** La web a la que vuelve el pago: el origen del pedido, si está entre los permitidos. */
  const origin = (request: FastifyRequest) => {
    const header = request.headers.origin;
    if (header && config.corsOrigins.includes(header)) return header;
    return config.corsOrigins[0] ?? 'http://localhost:3000';
  };

  addRoute(app, apiRoutes.checkoutQuote, {}, (request) =>
    checkout.quote(user(request).uid, request.body as QuoteBody),
  );

  addRoute(app, apiRoutes.createCheckout, { appCheck: true }, (request) => {
    const current = user(request);
    return checkout.create(
      { uid: current.uid, email: current.email, anonymous: current.anonymous },
      request.body as CheckoutBody,
      origin(request),
    );
  });

  addRoute(app, apiRoutes.order, {}, (request) =>
    checkout.order(user(request).uid, (request.params as { orderId: string }).orderId),
  );

  addRoute(app, apiRoutes.adminRefundOrder, {}, (request) => {
    const current = user(request);
    return checkout.refund(
      { uid: current.uid, email: current.email },
      (request.params as { orderId: string }).orderId,
      (request.body as { reason: string }).reason,
    );
  });

  if (config.devToolsEnabled) {
    addRoute(app, apiRoutes.devSimulatePayment, {}, (request) =>
      checkout.simulatePayment(user(request).uid, (request.params as { orderId: string }).orderId),
    );
  }

  // Webhook del proveedor de pagos: se lee el cuerpo crudo para verificar la firma.
  void app.register((scope, _opts, done) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, next) => {
      next(null, body);
    });
    scope.post<{ Params: { provider: string } }>(
      '/v1/webhooks/payments/:provider',
      async (request, reply) => {
        const headers = Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [
            key.toLowerCase(),
            Array.isArray(value) ? value.join(',') : value,
          ]),
        );
        const outcome = await checkout.handleWebhook(
          request.params.provider,
          String(request.body),
          headers,
        );
        return reply.send({ received: true, outcome });
      },
    );
    done();
  });
}
