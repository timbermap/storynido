import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import type { AccountService } from '../accounts/service';
import { addRoute } from '../plugins/route';

type MergeBody = z.output<(typeof apiRoutes)['mergeAnonymous']['body']>;

export function registerAccountRoutes(app: FastifyInstance, accounts: AccountService): void {
  addRoute(app, apiRoutes.mergeAnonymous, { appCheck: true }, async (request) => {
    // requireAccess('user') garantiza la sesión.
    if (!request.user) throw new Error('Ruta protegida sin usuario');
    const moved = await accounts.mergeAnonymous(
      { uid: request.user.uid, email: request.user.email },
      (request.body as MergeBody).anonymousIdToken,
    );
    return { moved };
  });
}
