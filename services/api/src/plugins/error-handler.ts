import type { ApiErrorBody } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

import { AppError } from '../errors';

/** Todas las respuestas de error tienen el mismo formato: { error: { code, message, requestId } }. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const body = (
      code: ApiErrorBody['error']['code'],
      message: string,
      details?: unknown,
    ): ApiErrorBody => ({
      error: {
        code,
        message,
        requestId: request.id,
        ...(details === undefined ? {} : { details }),
      },
    });

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(body(error.code, error.message, error.details));
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues = error.validation.map((issue) => ({
        path: issue.instancePath,
        message: issue.message,
      }));
      return reply
        .status(400)
        .send(body('validation_failed', 'Los datos enviados no son válidos.', issues));
    }

    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 500;
    if (statusCode === 429) {
      return reply
        .status(429)
        .send(body('rate_limited', 'Demasiadas solicitudes. Prueba de nuevo en un momento.'));
    }
    if (statusCode >= 400 && statusCode < 500) {
      const message = error instanceof Error ? error.message : 'Solicitud inválida.';
      return reply.status(statusCode).send(body('bad_request', message));
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send(body('internal', 'Ocurrió un error inesperado.'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: {
        code: 'not_found',
        message: `No existe ${request.method} ${request.url}`,
        requestId: request.id,
      },
    } satisfies ApiErrorBody),
  );
}
