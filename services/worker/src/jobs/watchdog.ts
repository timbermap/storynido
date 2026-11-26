import type { EmailNotifier } from '@storynido/emails';
import {
  COLLECTIONS,
  JUDGE_GATE_CODE,
  JUDGE_GATE_MAX_WAIT_MS,
  type PipelineEvent,
} from '@storynido/shared';
import { orderLogFields } from '@storynido/shared/server';
import type { FastifyBaseLogger } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

/** Un pedido "generando" por más de esto está atascado (el pipeline completo tarda minutos). */
export const STUCK_AFTER_MS = 2 * 3600 * 1000;

type Timestampish = { toDate(): Date } | Date | null | undefined;
const asDate = (value: Timestampish) =>
  value instanceof Date ? value : value ? value.toDate() : null;

/**
 * Vigía del pipeline (Cloud Scheduler cada 30 minutos): pedidos que siguen generando hace más
 * de 2 horas. Avisa al equipo una vez por ejecución atascada y deja un log de error, del que
 * sale la alerta de Cloud Monitoring.
 */
export class PipelineWatchdog {
  constructor(
    private readonly db: Firestore,
    private readonly notifier: EmailNotifier,
    private readonly log: FastifyBaseLogger,
    private readonly projectId: string,
    /** Vuelve a correr la entrega de un pedido (el mismo camino que el botón del admin). */
    private readonly retry: ((event: PipelineEvent) => Promise<unknown>) | null = null,
  ) {}

  async run(now = new Date()): Promise<{ stuck: string[]; released: string[] }> {
    const generating = await this.db
      .collection(COLLECTIONS.orders)
      .where('status', '==', 'generating')
      .get();
    const stuck: string[] = [];
    for (const doc of generating.docs) {
      const startedAt = asDate(doc.get('pipeline.startedAt') as Timestampish);
      if (!startedAt || now.getTime() - startedAt.getTime() < STUCK_AFTER_MS) continue;
      stuck.push(doc.id);
      const runId = String(doc.get('pipeline.runId') ?? 'sin-run');
      this.log.error(
        {
          ...orderLogFields(doc.id, this.projectId),
          event: 'pipeline_stuck',
          runId,
          minutes: Math.round((now.getTime() - startedAt.getTime()) / 60_000),
        },
        'pipeline stuck',
      );
      await this.notifier.adminAlert({
        key: `alert:${doc.id}:pipeline_stuck:${runId}`,
        kind: 'pipeline_stuck',
        orderId: doc.id,
        message: `El pedido lleva más de 2 horas generando (ejecución ${runId}). Revisarlo en el admin.`,
      });
    }
    return { stuck, released: await this.releaseGated(now) };
  }

  /**
   * Tope del freno de la mesa (DECISIONS 351): un libro frenado que nadie miró en 24 h se entrega
   * como está, para que la familia no se quede sin su libro. Queda registrado quién lo soltó.
   */
  private async releaseGated(now: Date): Promise<string[]> {
    if (!this.retry) return [];
    const failed = await this.db
      .collection(COLLECTIONS.orders)
      .where('status', '==', 'qa_failed')
      .get();
    const released: string[] = [];
    for (const doc of failed.docs) {
      if (doc.get('pipeline.failedStep') !== 'layout_pdf') continue;
      const error = String(doc.get('pipeline.error') ?? '');
      if (!error.startsWith(JUDGE_GATE_CODE)) continue;
      const finishedAt = asDate(doc.get('pipeline.finishedAt') as Timestampish);
      if (!finishedAt || now.getTime() - finishedAt.getTime() < JUDGE_GATE_MAX_WAIT_MS) continue;
      const generation = Number(doc.get('pipeline.generation') ?? 0);
      await doc.ref.update({ 'pipeline.judgeApproval': { generation, by: 'tope-24h' } });
      await this.retry({
        type: 'order.retry_step',
        orderId: doc.id,
        fromStep: 'layout_pdf',
        requestId: `judge-gate-timeout:${doc.id}:${String(generation)}`,
      });
      released.push(doc.id);
      this.log.error(
        { ...orderLogFields(doc.id, this.projectId), event: 'judge_gate_timeout', generation },
        'judge gate released after 24 h',
      );
      await this.notifier.adminAlert({
        key: `alert:${doc.id}:judge_gate_timeout:${String(generation)}`,
        kind: 'pipeline_failed',
        orderId: doc.id,
        message:
          'Pasaron 24 h sin revisar un libro que frenó la mesa: se entregó como estaba. Conviene mirarlo y ofrecer rehacerlo.',
      });
    }
    return released;
  }
}
