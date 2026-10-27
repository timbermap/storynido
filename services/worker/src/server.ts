import { cloudLoggingOptions } from '@storynido/shared/server';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { buildApp } from './app';
import { loadWorkerEnv } from './config';
import { simulatedHandlers } from './pipeline/handlers';
import {
  CloudTasksDispatcher,
  CloudWorkflowsOrchestrator,
  InlineDispatcher,
  LocalOrchestrator,
} from './pipeline/orchestrators';
import { Pipeline } from './pipeline/pipeline';

const env = loadWorkerEnv(process.env);

// Con FIRESTORE_EMULATOR_HOST usa el emulador.
const firebase =
  getApps()[0] ?? initializeApp({ projectId: env.GCP_PROJECT_ID || 'demo-storynido' });

// La app y los orquestadores locales llaman al pipeline recién al atender pedidos, cuando ya existe.
const current = (): Pipeline => pipeline;

const app = buildApp({
  logger: cloudLoggingOptions('worker', env.LOG_LEVEL),
  version: env.K_REVISION,
  pipeline: current,
});

const gcp = { projectId: env.GCP_PROJECT_ID, region: env.GCP_REGION };
const cloud = env.PIPELINE_RUNNER === 'cloud';
const pipeline = new Pipeline(
  getFirestore(firebase),
  // Fase 08: pasos simulados. La fase 09 conecta la generación real.
  simulatedHandlers(),
  cloud
    ? new CloudWorkflowsOrchestrator({ ...gcp, workflow: env.WORKFLOW_NAME })
    : new LocalOrchestrator(current, app.log, env.LOCAL_RETRY_BASE_MS),
  cloud
    ? new CloudTasksDispatcher({
        ...gcp,
        queue: env.ILLUSTRATION_QUEUE,
        workerUrl: env.WORKER_URL,
        invokerEmail: env.INVOKER_SA,
      })
    : new InlineDispatcher(current, app.log, env.LOCAL_RETRY_BASE_MS),
  app.log,
);

// Cloud Run envía SIGTERM antes de apagar la instancia.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
