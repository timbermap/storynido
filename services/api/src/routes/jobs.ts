import type { FastifyInstance } from 'fastify';

import { AppError, unauthorized } from '../errors';
import type { JobCallerVerifier } from '../jobs-auth';
import type { PreviewService } from '../preview/service';

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Trabajos programados de la API (Cloud Scheduler). Sin verificador configurado (local, o un
 * ambiente sin JOBS_INVOKER_EMAIL) las rutas no existen.
 */
export function registerJobRoutes(
  app: FastifyInstance,
  previews: PreviewService,
  caller: JobCallerVerifier | undefined,
): void {
  // Fila de muestras sin cupo de IA: las arranca apenas hay presupuesto.
  app.post('/jobs/preview-queue', async (request) => {
    if (!caller) throw new AppError(404, 'not_found', 'Ruta no encontrada.');
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token || !(await caller.verify(token))) throw unauthorized('Llamada no autorizada.');
    return previews.processQueue();
  });
}
