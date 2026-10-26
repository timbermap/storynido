import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';

import { addRoute } from '../plugins/route';

export function registerV1Routes(app: FastifyInstance): void {
  const { deps } = app;

  addRoute(app, apiRoutes.health, { availability: 'always' }, () => ({
    status: 'ok' as const,
    service: 'api',
    version: deps.version,
  }));

  addRoute(app, apiRoutes.siteConfig, { availability: 'always' }, () => ({
    mode: deps.siteConfig.mode(),
  }));

  addRoute(app, apiRoutes.me, {}, (request) => {
    // requireAccess('user') garantiza la sesión.
    const user = request.user;
    if (!user) throw new Error('Ruta protegida sin usuario');
    return { uid: user.uid, email: user.email, role: user.role };
  });

  addRoute(app, apiRoutes.adminProviders, {}, () => {
    const { active, available } = deps.providers.describe();
    return { active, available };
  });
}
