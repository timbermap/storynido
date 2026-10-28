import type { EmailNotifier } from '@storynido/emails';
import { COLLECTIONS } from '@storynido/shared';
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
  ) {}

  async run(now = new Date()): Promise<{ stuck: string[] }> {
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
    return { stuck };
  }
}
