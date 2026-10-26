import { apiErrorSchema, type ApiRoute } from '@storynido/shared';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
  preHandlerHookHandler,
} from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { z } from 'zod';

import type { Availability } from '../types';
import { requireAccess, requireAppCheck } from './auth';

export interface RouteOptions {
  availability?: Availability;
  appCheck?: boolean;
}

type Handler<R extends ApiRoute> = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<z.input<R['response']>> | z.input<R['response']>;

/**
 * Registra una ruta a partir del contrato compartido: método, path, validación,
 * respuesta, documentación OpenAPI y control de acceso salen de `apiRoutes`.
 */
export function addRoute<R extends ApiRoute>(
  app: FastifyInstance,
  route: R,
  options: RouteOptions,
  handler: Handler<R>,
): void {
  const preHandler: (preHandlerHookHandler | preHandlerAsyncHookHandler)[] = [
    requireAccess(route.access),
  ];
  if (options.appCheck) preHandler.push(requireAppCheck);

  app.withTypeProvider<ZodTypeProvider>().route({
    method: route.method,
    url: route.path,
    schema: {
      summary: route.summary,
      tags: [route.access === 'public' ? 'public' : route.access],
      security: route.access === 'public' ? [] : [{ bearerAuth: [] }],
      ...(route.body ? { body: route.body } : {}),
      ...(route.query ? { querystring: route.query } : {}),
      response: { 200: route.response, '4xx': apiErrorSchema, '5xx': apiErrorSchema },
    },
    config: { availability: options.availability ?? 'normal' },
    preHandler,
    handler,
  });
}
