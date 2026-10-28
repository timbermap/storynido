import { cloudTraceHeader, orderTraceId } from '@storynido/shared/server';
import { ILLUSTRATION_PAGE_POLICY, retryDelayMs } from '@storynido/shared';
import { gcpPost } from '@storynido/shared/server';
import type { FastifyBaseLogger } from 'fastify';

import type {
  IllustrationDispatcher,
  IllustrationTaskRef,
  Orchestrator,
  Pipeline,
  PipelineRun,
} from './pipeline';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Orquestador local: la misma lógica que `infra/workflows/order-pipeline.yaml`, dentro del
 * worker, para desarrollo y tests sin GCP. Pasos en orden, reintentos con espera exponencial,
 * consulta de las ilustraciones repartidas y cierre (listo o revisión manual).
 */
export class LocalOrchestrator implements Orchestrator {
  private readonly running = new Set<Promise<void>>();

  constructor(
    private readonly pipeline: () => Pipeline,
    private readonly log: FastifyBaseLogger,
    private readonly retryBaseMs = 2000,
    private readonly pollMs = Math.max(retryBaseMs / 4, 1),
  ) {}

  start(run: PipelineRun): Promise<void> {
    const task = this.execute(run)
      .catch((error: unknown) => {
        this.log.error({ err: error, orderId: run.orderId }, 'local orchestrator crashed');
      })
      .finally(() => {
        this.running.delete(task);
      });
    this.running.add(task);
    return Promise.resolve();
  }

  /** Espera a que terminen las ejecuciones en curso (tests y apagado). */
  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.all([...this.running]);
  }

  private async execute(run: PipelineRun): Promise<void> {
    const pipeline = this.pipeline();
    for (const step of run.steps) {
      let attempt = 0;
      for (;;) {
        try {
          const outcome = await pipeline.runStep(run.orderId, step.name, run.generation);
          if (outcome.state === 'stale') return;
          if (outcome.state === 'human_review') {
            await pipeline.fail(run.orderId, run.runId, step.name, outcome.reason);
            return;
          }
          if (outcome.state === 'busy') {
            await sleep(this.pollMs);
            continue;
          }
          if (outcome.state === 'waiting') {
            const status = await this.waitForIllustrations(run);
            if (status === 'stale') return;
          }
          break;
        } catch (error) {
          attempt += 1;
          if (attempt >= step.maxAttempts) {
            const reason = error instanceof Error ? error.message : String(error);
            await pipeline.fail(run.orderId, run.runId, step.name, reason);
            return;
          }
          await sleep(retryDelayMs(attempt, this.retryBaseMs));
        }
      }
    }
    await pipeline.finish(run.orderId, run.runId);
  }

  private async waitForIllustrations(run: PipelineRun): Promise<'succeeded' | 'stale'> {
    const pipeline = this.pipeline();
    for (;;) {
      const status = await pipeline.illustrationStatus(run.orderId, run.generation);
      if (status.state === 'succeeded' || status.state === 'stale') return status.state;
      if (status.state === 'failed') throw new Error(status.error);
      await sleep(this.pollMs);
    }
  }
}

/** Reparte las páginas en el mismo proceso, con los reintentos que haría Cloud Tasks. */
export class InlineDispatcher implements IllustrationDispatcher {
  private readonly running = new Set<Promise<void>>();

  constructor(
    private readonly pipeline: () => Pipeline,
    private readonly log: FastifyBaseLogger,
    private readonly retryBaseMs = 2000,
  ) {}

  dispatch(task: IllustrationTaskRef): Promise<void> {
    const job = this.execute(task).finally(() => {
      this.running.delete(job);
    });
    this.running.add(job);
    return Promise.resolve();
  }

  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.all([...this.running]);
  }

  private async execute(task: IllustrationTaskRef) {
    for (let attempt = 1; attempt <= ILLUSTRATION_PAGE_POLICY.maxAttempts; attempt += 1) {
      try {
        await this.pipeline().runIllustrationPage(task.orderId, task.generation, task.index);
        return;
      } catch {
        await sleep(retryDelayMs(attempt, this.retryBaseMs));
      }
    }
    this.log.warn(task, 'illustration task exhausted');
  }
}

export interface GcpTarget {
  projectId: string;
  region: string;
  fetch?: typeof fetch;
}

/** Arranca una ejecución de Cloud Workflows (`order-pipeline`) con los pasos y sus políticas. */
export class CloudWorkflowsOrchestrator implements Orchestrator {
  constructor(private readonly target: GcpTarget & { workflow: string }) {}

  async start(run: PipelineRun): Promise<void> {
    const { projectId, region, workflow } = this.target;
    const url = `https://workflowexecutions.googleapis.com/v1/projects/${projectId}/locations/${region}/workflows/${workflow}/executions`;
    // `trace`: Workflows la manda en cada llamada al worker (una sola traza por pedido).
    const argument = JSON.stringify({ ...run, trace: orderTraceId(run.orderId) });
    const res = await gcpPost(url, { argument }, this.target.fetch);
    if (res.status >= 300) {
      throw new Error(`Workflows: HTTP ${String(res.status)} ${JSON.stringify(res.json)}`);
    }
  }
}

/**
 * Una tarea de Cloud Tasks por página. El nombre es determinístico por reparto: si el mismo
 * reparto llega dos veces, Cloud Tasks lo rechaza (409) y no se duplica; un reintento de las
 * ilustraciones es otro reparto y otro nombre (Cloud Tasks no reutiliza nombres por ~1 h).
 */
export class CloudTasksDispatcher implements IllustrationDispatcher {
  constructor(
    private readonly target: GcpTarget & {
      queue: string;
      workerUrl: string;
      invokerEmail: string;
    },
  ) {}

  async dispatch(task: IllustrationTaskRef): Promise<void> {
    const { projectId, region, queue, workerUrl, invokerEmail } = this.target;
    const parent = `projects/${projectId}/locations/${region}/queues/${queue}`;
    const name = `${parent}/tasks/${task.orderId}-g${String(task.generation)}-p${String(task.index)}-d${String(task.dispatch)}`;
    const res = await gcpPost(
      `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
      {
        task: {
          name,
          httpRequest: {
            httpMethod: 'POST',
            url: `${workerUrl}/pipeline/illustrations/run`,
            // La traza del pedido: Cloud Run agrupa cada página con el resto del pedido.
            headers: {
              'Content-Type': 'application/json',
              'X-Cloud-Trace-Context': cloudTraceHeader(orderTraceId(task.orderId)),
            },
            body: Buffer.from(JSON.stringify(task)).toString('base64'),
            oidcToken: { serviceAccountEmail: invokerEmail, audience: workerUrl },
          },
        },
      },
      this.target.fetch,
    );
    if (res.status === 409) return;
    if (res.status >= 300) {
      throw new Error(`Cloud Tasks: HTTP ${String(res.status)} ${JSON.stringify(res.json)}`);
    }
  }
}
