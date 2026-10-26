import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { addRoute } from '../plugins/route';
import type { PhotoService } from '../photos/service';

type Routes = typeof apiRoutes;
type BodyOf<K extends keyof Routes> = Routes[K] extends { body: infer B extends z.ZodType }
  ? z.output<B>
  : never;
type ParamsOf<K extends keyof Routes> = Routes[K] extends { params: infer P extends z.ZodType }
  ? z.output<P>
  : never;

function uid(request: FastifyRequest): string {
  // requireAccess('user') garantiza la sesión.
  if (!request.user) throw new Error('Ruta protegida sin usuario');
  return request.user.uid;
}

export function registerPhotoRoutes(app: FastifyInstance, photos: PhotoService): void {
  addRoute(app, apiRoutes.createConsent, { appCheck: true }, async (request) => {
    const body = request.body as BodyOf<'createConsent'>;
    const consentId = await photos.recordConsent({
      uid: uid(request),
      textVersion: body.textVersion,
      locale: body.locale,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
    return { consentId };
  });

  addRoute(app, apiRoutes.createPhoto, { appCheck: true }, async (request) => {
    const body = request.body as BodyOf<'createPhoto'>;
    return photos.createUpload({
      uid: uid(request),
      bookId: body.bookId,
      consentId: body.consentId,
      contentType: body.contentType,
    });
  });

  addRoute(app, apiRoutes.processPhoto, { appCheck: true }, async (request) =>
    photos.process(uid(request), (request.params as ParamsOf<'processPhoto'>).photoId),
  );

  addRoute(app, apiRoutes.bookPhotos, {}, async (request) => ({
    photos: await photos.listForBook(
      uid(request),
      (request.params as ParamsOf<'bookPhotos'>).bookId,
    ),
  }));

  addRoute(app, apiRoutes.deletePhoto, {}, async (request) => {
    await photos.delete(uid(request), (request.params as ParamsOf<'deletePhoto'>).photoId);
    return { deleted: true as const };
  });
}
