import Fastify, { type FastifyServerOptions } from 'fastify';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  version: string;
}

export function buildApp({ logger = false, version }: AppOptions) {
  const app = Fastify({ logger });

  // Cloud Run reserva las rutas que terminan en "z" (p. ej. /healthz), por eso se usa /health.
  app.get('/health', () => ({ status: 'ok', service: 'api', version }));

  return app;
}
