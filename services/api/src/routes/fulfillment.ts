import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { AppError } from '../errors';
import type { FulfillmentService } from '../orders/fulfillment';
import { addRoute } from '../plugins/route';

function user(request: FastifyRequest) {
  if (!request.user) throw new AppError(401, 'unauthorized', 'Inicia sesión.');
  return request.user;
}

const orderId = (request: FastifyRequest) => (request.params as { orderId: string }).orderId;

export function registerFulfillmentRoutes(app: FastifyInstance, fulfillment: FulfillmentService) {
  addRoute(app, apiRoutes.orderDownload, {}, (request) =>
    fulfillment.download(
      user(request).uid,
      orderId(request),
      (request.query as { file?: string }).file ?? 'book',
    ),
  );

  addRoute(app, apiRoutes.orderReview, {}, (request) =>
    fulfillment.review(
      user(request).uid,
      orderId(request),
      request.body as { rating: number; comment: string | null },
    ),
  );

  addRoute(app, apiRoutes.adminCancelPrint, {}, (request) => {
    const current = user(request);
    return fulfillment.cancelPrint({ uid: current.uid, email: current.email }, orderId(request));
  });

  if (app.deps.config.devToolsEnabled) {
    addRoute(app, apiRoutes.devSimulatePrint, {}, (request) =>
      fulfillment.simulatePrint(user(request).uid, orderId(request)),
    );
  }

  // Webhook de la imprenta: cuerpo crudo para verificar la firma.
  void app.register((scope, _opts, done) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, next) => {
      next(null, body);
    });
    scope.post<{ Params: { provider: string } }>(
      '/v1/webhooks/print/:provider',
      async (request, reply) => {
        const headers = Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [
            key.toLowerCase(),
            Array.isArray(value) ? value.join(',') : value,
          ]),
        );
        const outcome = await fulfillment.handlePrintWebhook(
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
