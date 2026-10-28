import { COLLECTIONS, apiRoutes } from '@storynido/shared';
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

  addRoute(app, apiRoutes.me, {}, async (request) => {
    // requireAccess('user') garantiza la sesión.
    const user = request.user;
    if (!user) throw new Error('Ruta protegida sin usuario');
    // Bienvenida, una sola vez por cuenta (la sesión anónima del creador no es una cuenta).
    if (!user.anonymous && user.email) {
      const profile = (await deps.db.collection(COLLECTIONS.users).doc(user.uid).get()).data();
      const saved: unknown = profile?.locale;
      const locale = saved === 'en' || saved === 'pt' ? saved : 'es';
      await deps.notifier.notify({
        key: `welcome:${user.uid}`,
        template: 'welcome',
        uid: user.uid,
        to: user.email,
        locale,
        data: {
          name: typeof profile?.displayName === 'string' ? profile.displayName : null,
          url: deps.notifier.createUrl(locale),
        },
      });
    }
    return { uid: user.uid, email: user.email, role: user.role };
  });

  addRoute(app, apiRoutes.adminProviders, {}, () => {
    const { active, available } = deps.providers.describe();
    return { active, available };
  });
}
