import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { AccountService } from '../accounts/service';
import type { PreviewService } from '../preview/service';
import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

type MergeBody = z.output<(typeof apiRoutes)['mergeAnonymous']['body']>;

export function registerAccountRoutes(
  app: FastifyInstance,
  accounts: AccountService,
  previews: PreviewService,
): void {
  addRoute(app, apiRoutes.mergeAnonymous, { appCheck: true }, async (request) => {
    // requireAccess('user') garantiza la sesión.
    if (!request.user) throw new Error('Ruta protegida sin usuario');
    const moved = await accounts.mergeAnonymous(
      { uid: request.user.uid, email: request.user.email },
      (request.body as MergeBody).anonymousIdToken,
    );
    return { moved };
  });

  addRoute(app, apiRoutes.deleteChild, {}, (request) => {
    const user = signedIn(request);
    return accounts.deleteChild(user, (request.params as { childId: string }).childId);
  });

  addRoute(app, apiRoutes.getChildProfile, {}, async (request) => {
    const user = signedIn(request);
    const { childId } = request.params as { childId: string };
    const [profile, drawing] = await Promise.all([
      accounts.childProfile(user.uid, childId),
      previews.childDrawing(user.uid, childId),
    ]);
    const { imageUrl, ...rest } = drawing;
    // El dibujo aprobado en su perfil manda; si no hay, la lámina de su último cuento.
    return { ...profile, characterImageUrl: imageUrl ?? profile.characterImageUrl, drawing: rest };
  });

  addRoute(app, apiRoutes.deleteChildPhotos, {}, (request) => {
    const user = signedIn(request);
    return accounts.deleteChildPhotos(user, (request.params as { childId: string }).childId);
  });

  addRoute(app, apiRoutes.deleteAccount, {}, (request) =>
    accounts.deleteAccount(signedIn(request)),
  );
}

/** Borrar datos pide una cuenta de verdad (no una sesión anónima). */
function signedIn(request: FastifyRequest) {
  if (!request.user || request.user.anonymous) {
    throw new AppError(403, 'account_required', 'Inicia sesión con tu cuenta.');
  }
  return { uid: request.user.uid, email: request.user.email };
}
