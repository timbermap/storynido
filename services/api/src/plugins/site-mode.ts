import { isAdminRole } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';

import { AppError } from '../errors';

/**
 * Respeta el interruptor general del sitio (siteConfig/global):
 * - maintenance: solo responden las rutas `always`, salvo para admins.
 * - preview_only: las rutas `live_only` (compra) quedan bloqueadas.
 */
export function registerSiteMode(app: FastifyInstance): void {
  app.addHook('preHandler', (request, _reply, done) => {
    const availability = request.routeOptions.config.availability ?? 'normal';
    if (availability === 'always' || (request.user && isAdminRole(request.user.role))) {
      done();
      return;
    }

    const mode = app.deps.siteConfig.mode();
    if (mode === 'maintenance') {
      done(new AppError(503, 'maintenance', 'Estamos haciendo mantenimiento. Volvé en un rato.'));
    } else if (mode === 'preview_only' && availability === 'live_only') {
      done(new AppError(403, 'unavailable_in_mode', 'Las compras están pausadas por el momento.'));
    } else {
      done();
    }
  });
}
