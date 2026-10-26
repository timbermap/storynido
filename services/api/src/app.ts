import { LocalStorageService } from '@storynido/providers';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import type { ApiDeps } from './deps';
import { registerAuthentication } from './plugins/auth';
import { registerDocs } from './plugins/docs';
import { registerErrorHandling } from './plugins/error-handler';
import { registerSecurity } from './plugins/security';
import { registerSiteMode } from './plugins/site-mode';
import { registerDevStorageRoutes } from './routes/dev-storage';
import { registerV1Routes } from './routes/v1';
import './types';

export interface AppOptions {
  deps: ApiDeps;
  logger?: FastifyServerOptions['logger'];
  /** Rutas adicionales antes de arrancar (tests). */
  extend?: (app: FastifyInstance) => void;
}

export async function buildApp({ deps, logger = false, extend }: AppOptions) {
  const app = Fastify({
    logger,
    // Cloud Run está detrás de un balanceador: la IP real viene en X-Forwarded-For.
    trustProxy: true,
    // Cloud Run reserva las rutas que terminan en "z" (p. ej. /healthz), por eso se usa /health.
    ignoreTrailingSlash: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('deps', deps);

  registerErrorHandling(app);
  registerAuthentication(app);
  await registerSecurity(app);
  registerSiteMode(app);
  await registerDocs(app);

  registerV1Routes(app);
  extend?.(app);

  const storage = deps.providers.storage();
  if (deps.config.devToolsEnabled && storage instanceof LocalStorageService) {
    await registerDevStorageRoutes(app, storage);
  }

  await app.ready();
  return app;
}
