import { z } from 'zod';

export const serviceEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  /** Cloud Run define K_REVISION con la revisión desplegada. */
  K_REVISION: z.string().default('local'),
});

export type ServiceEnv = z.infer<typeof serviceEnvSchema>;

export function parseServiceEnv(
  env: Record<string, string | undefined>,
  defaultPort: number,
): ServiceEnv {
  return serviceEnvSchema.parse({ ...env, PORT: env.PORT ?? defaultPort });
}
