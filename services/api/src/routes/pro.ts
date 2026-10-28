import { apiRoutes, type ProProfile } from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { AppError } from '../errors';
import { addRoute } from '../plugins/route';
import type { ProService } from '../pro/service';

function user(request: FastifyRequest) {
  if (!request.user) throw new AppError(401, 'unauthorized', 'Inicia sesión.');
  return request.user;
}

export function registerProRoutes(app: FastifyInstance, pro: ProService): void {
  addRoute(app, apiRoutes.proActivate, {}, (request) => {
    const current = user(request);
    return pro.activate(
      { uid: current.uid, anonymous: current.anonymous },
      request.body as ProProfile,
    );
  });

  addRoute(app, apiRoutes.proStatus, {}, (request) => pro.status(user(request).uid));
}
