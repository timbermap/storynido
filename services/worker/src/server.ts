import { cloudLoggingOptions, parseServiceEnv } from '@storynido/shared/server';

import { buildApp } from './app';

const env = parseServiceEnv(process.env, 8081);

const app = buildApp({
  logger: cloudLoggingOptions('worker', env.LOG_LEVEL),
  version: env.K_REVISION,
});

// Cloud Run envía SIGTERM antes de apagar la instancia.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
