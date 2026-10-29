import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { addRoute } from '../plugins/route';
import type { PreviewService } from '../preview/service';

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

export function registerPreviewRoutes(app: FastifyInstance, previews: PreviewService): void {
  // Generar gasta IA: App Check obligatorio (en producción) además de las cuotas.
  addRoute(app, apiRoutes.generatePreview, { appCheck: true }, async (request) =>
    previews.generate(
      uid(request),
      (request.params as ParamsOf<'generatePreview'>).bookId,
      request.ip,
      request.user?.anonymous ?? true,
    ),
  );

  addRoute(app, apiRoutes.bookPreview, {}, async (request) =>
    previews.get(uid(request), (request.params as ParamsOf<'bookPreview'>).bookId),
  );

  addRoute(app, apiRoutes.updatePreviewPage, { appCheck: true }, async (request) => {
    const params = request.params as ParamsOf<'updatePreviewPage'>;
    return previews.updatePageText(
      uid(request),
      params.bookId,
      params.index,
      (request.body as BodyOf<'updatePreviewPage'>).text,
    );
  });

  addRoute(app, apiRoutes.deleteDraft, {}, async (request) =>
    previews.deleteDraft(uid(request), (request.params as ParamsOf<'deleteDraft'>).bookId),
  );

  addRoute(app, apiRoutes.previewFeedback, { appCheck: true }, async (request) =>
    previews.feedback(
      uid(request),
      (request.params as ParamsOf<'previewFeedback'>).bookId,
      (request.body as BodyOf<'previewFeedback'>).reasons,
    ),
  );

  addRoute(app, apiRoutes.approveCharacter, { appCheck: true }, async (request) =>
    previews.approveCharacter(
      uid(request),
      (request.params as ParamsOf<'approveCharacter'>).bookId,
      request.user?.anonymous ?? true,
    ),
  );

  addRoute(app, apiRoutes.updateCharacter, { appCheck: true }, async (request) => {
    const body = request.body as BodyOf<'updateCharacter'>;
    return previews.updateCharacter(
      uid(request),
      (request.params as ParamsOf<'updateCharacter'>).bookId,
      body.traits,
      body.mustKeep,
    );
  });

  addRoute(app, apiRoutes.regeneratePreviewIllustration, { appCheck: true }, async (request) => {
    const params = request.params as ParamsOf<'regeneratePreviewIllustration'>;
    return previews.regenerate(uid(request), params.bookId, params.target, request.ip);
  });
}
