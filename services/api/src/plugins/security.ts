import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

import { AppError } from '../errors';

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  const { config } = app.deps;

  await app.register(helmet, {
    // La API solo devuelve JSON y archivos; Swagger UI necesita CSP relajada en desarrollo.
    contentSecurityPolicy: config.devToolsEnabled ? false : undefined,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'x-firebase-appcheck'],
    maxAge: 600,
  });

  // Por usuario si hay sesión, si no por IP. Corre después de autenticar.
  // En Cloud Run el contador es por instancia (suficiente como freno; ver DECISIONS).
  await app.register(rateLimit, {
    global: true,
    hook: 'preHandler',
    max: config.rateLimitPerMinute,
    timeWindow: '1 minute',
    keyGenerator: (request) => (request.user ? `uid:${request.user.uid}` : `ip:${request.ip}`),
    errorResponseBuilder: () =>
      new AppError(429, 'rate_limited', 'Demasiadas solicitudes. Probá de nuevo en un momento.'),
  });
}
