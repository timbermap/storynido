import type { FastifyInstance } from 'fastify';

import { AppError, unauthorized } from '../errors';
import type { JobCallerVerifier } from '../jobs-auth';
import type { PreviewService } from '../preview/service';
import type { SocialService } from '../social/service';

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Trabajos programados de la API (Cloud Scheduler). Sin verificador configurado (local, o un
 * ambiente sin JOBS_INVOKER_EMAIL) las rutas no existen.
 */
export function registerJobRoutes(
  app: FastifyInstance,
  previews: PreviewService,
  social: SocialService,
  caller: JobCallerVerifier | undefined,
): void {
  // Fila de muestras sin cupo de IA: las arranca apenas hay presupuesto.
  const authorize = async (authorization: string | undefined) => {
    if (!caller) throw new AppError(404, 'not_found', 'Ruta no encontrada.');
    const token = BEARER.exec(authorization ?? '')?.[1];
    if (!token || !(await caller.verify(token))) throw unauthorized('Llamada no autorizada.');
  };
  app.post('/jobs/preview-queue', async (request) => {
    await authorize(request.headers.authorization);
    return previews.processQueue();
  });
  // Lectura diaria de Pinterest, Instagram y TikTok para el panel de Marketing.
  app.post('/jobs/social-sync', async (request) => {
    await authorize(request.headers.authorization);
    return { results: await social.sync(3) };
  });
}
