import type { LocalStorageService } from '@storynido/providers';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { AppError } from '../errors';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

interface StorageRequest {
  Params: { bucket: string; '*': string };
  Querystring: { op?: string; exp?: string; ct?: string; sig?: string };
}

/**
 * Sirve las URLs firmadas del storage local (solo desarrollo y staging con storage local).
 * En la nube las URLs firmadas apuntan directo a Cloud Storage.
 */
export async function registerDevStorageRoutes(
  app: FastifyInstance,
  storage: LocalStorageService,
): Promise<void> {
  await app.register((scope, _opts, done) => {
    scope.addContentTypeParser(
      '*',
      { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
      (_req, body, next) => {
        next(null, body);
      },
    );

    const verify = (request: FastifyRequest<StorageRequest>, op: 'get' | 'put') => {
      const { op: queryOp, exp, ct, sig } = request.query;
      const ref =
        queryOp === op
          ? storage.verifySignedRequest({
              op,
              bucket: request.params.bucket,
              path: request.params['*'],
              exp: Number(exp),
              ct: ct ?? '',
              sig: sig ?? '',
            })
          : null;
      if (!ref) throw new AppError(403, 'forbidden', 'URL firmada inválida o vencida.');
      return ref;
    };

    const hidden = {
      schema: { hide: true },
      config: { availability: 'always' as const, rateLimit: false as const },
    };

    scope.put<StorageRequest>('/dev/storage/:bucket/*', hidden, async (request, reply) => {
      const ref = verify(request, 'put');
      const expectedType = request.query.ct ?? '';
      if (request.headers['content-type'] !== expectedType) {
        throw new AppError(400, 'bad_request', `El Content-Type debe ser ${expectedType}.`);
      }
      if (!Buffer.isBuffer(request.body))
        throw new AppError(400, 'bad_request', 'Falta el archivo.');
      await storage.upload(ref, request.body, expectedType);
      return reply.status(204).send();
    });

    scope.get<StorageRequest>('/dev/storage/:bucket/*', hidden, async (request, reply) => {
      const ref = verify(request, 'get');
      if (!(await storage.exists(ref)))
        throw new AppError(404, 'not_found', 'El archivo no existe.');
      return reply
        .type(await storage.contentType(ref))
        .send(Buffer.from(await storage.download(ref)));
    });

    done();
  });
}
