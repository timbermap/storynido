import { LocalStorageService } from '@storynido/providers';
import { utcDay } from '@storynido/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import type { ApiDeps } from './deps';
import { registerAuthentication } from './plugins/auth';
import { registerDocs } from './plugins/docs';
import { registerErrorHandling } from './plugins/error-handler';
import { registerSecurity } from './plugins/security';
import { registerSiteMode } from './plugins/site-mode';
import { registerAccountRoutes } from './routes/accounts';
import { registerAdminRoutes } from './routes/admin';
import { registerAdminOrderRoutes } from './routes/admin-orders';
import { registerAdminOpsRoutes } from './routes/admin-ops';
import { registerAdminPeopleRoutes } from './routes/admin-people';
import { registerAiConfigRoutes } from './routes/ai-config';
import { registerCatalogRoutes } from './routes/catalog';
import { registerCheckoutRoutes } from './routes/checkout';
import { registerContactRoutes } from './routes/contact';
import { registerFulfillmentRoutes } from './routes/fulfillment';
import { registerDevStorageRoutes } from './routes/dev-storage';
import { registerOrderRoutes } from './routes/orders';
import { registerPhotoRoutes } from './routes/photos';
import { registerPreviewRoutes } from './routes/previews';
import { registerEmailRoutes } from './routes/email';
import { registerProRoutes } from './routes/pro';
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
  registerEmailRoutes(app);
  registerContactRoutes(app);
  registerProRoutes(app, deps.pro);
  registerCatalogRoutes(
    app,
    deps.catalog,
    deps.providers.printers().map((printer) => printer.id),
    () => deps.metrics.fx(utcDay()),
  );
  registerPhotoRoutes(app, deps.photos);
  registerPreviewRoutes(app, deps.previews);
  registerAiConfigRoutes(app, deps.db);
  registerAdminRoutes(app, deps.db);
  registerAdminOrderRoutes(app);
  registerAdminPeopleRoutes(app);
  registerAdminOpsRoutes(app);
  registerAccountRoutes(app, deps.accounts);
  registerOrderRoutes(app);
  registerCheckoutRoutes(app, deps.checkout);
  registerFulfillmentRoutes(app, deps.fulfillment);
  extend?.(app);

  const storage = deps.providers.storage();
  if (deps.config.devToolsEnabled && storage instanceof LocalStorageService) {
    await registerDevStorageRoutes(app, storage);
  }

  await app.ready();
  return app;
}
