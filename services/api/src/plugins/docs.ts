import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/** OpenAPI generado desde los esquemas Zod. Swagger UI en /docs fuera de producción. */
export async function registerDocs(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'StoryNido API',
        description: 'API de StoryNido: cuentos infantiles personalizados.',
        version: app.deps.version,
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  if (app.deps.config.devToolsEnabled) {
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }
}
