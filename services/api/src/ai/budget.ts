import {
  COLLECTIONS,
  GLOBAL_DOC_ID,
  aiConfigSchema,
  utcDay,
  type AiConfig,
  type AiUsage,
  type AiUsageRecord,
} from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { AppError } from '../errors';

/** Valores seguros si aiConfig todavía no existe (p. ej. un ambiente recién creado). */
export const AI_CONFIG_DEFAULTS: Omit<AiConfig, 'updatedAt' | 'updatedBy'> = {
  textProvider: 'mock',
  textModel: 'mock-text',
  imageProvider: 'mock',
  imageModel: 'mock-image',
  maxRegenerationsPerBook: 3,
  maxPreviewsPerUserPerDay: 5,
  illustrationsRequireAccount: true,
  dailyBudgetUsd: 5,
  budgetAlertPercent: 80,
};

export type AiLimits = typeof AI_CONFIG_DEFAULTS;

export interface UsageContext {
  kind: AiUsageRecord['kind'];
  ownerUid: string | null;
  bookId: string | null;
}

export const budgetExceeded = () =>
  new AppError(
    503,
    'ai_unavailable',
    'Alcanzamos el límite de generación por hoy. Vuelve a intentarlo mañana; tu borrador queda guardado.',
  );

/**
 * Presupuesto diario de IA: cada llamada se registra en aiUsage con su costo estimado y se
 * acumula en aiBudget/{día}. Antes de cada llamada se verifica el tope (corte automático) y,
 * al pasar el porcentaje de alerta, se escribe un log de error que dispara la alerta de Monitoring.
 */
export class AiBudget {
  constructor(
    private readonly db: Firestore,
    private readonly log: FastifyBaseLogger,
  ) {}

  async limits(): Promise<AiLimits> {
    const snapshot = await this.db.collection(COLLECTIONS.aiConfig).doc(GLOBAL_DOC_ID).get();
    // Campo por campo: un valor inválido no invalida el resto (ni el Timestamp de updatedAt).
    const data = snapshot.data() ?? {};
    const shape = aiConfigSchema.shape;
    const limits: Record<string, unknown> = { ...AI_CONFIG_DEFAULTS };
    for (const key of Object.keys(AI_CONFIG_DEFAULTS) as (keyof AiLimits)[]) {
      const parsed = shape[key].safeParse(data[key]);
      if (parsed.success) limits[key] = parsed.data;
    }
    return limits as AiLimits;
  }

  private dayRef(day = utcDay()) {
    return this.db.collection(COLLECTIONS.aiBudget).doc(day);
  }

  async spentTodayUsdMicros(): Promise<number> {
    const value: unknown = (await this.dayRef().get()).get('spentUsdMicros');
    return typeof value === 'number' ? value : 0;
  }

  /** Corta si el gasto del día ya llegó al tope. */
  async ensureAvailable(limits: AiLimits): Promise<void> {
    if ((await this.spentTodayUsdMicros()) >= limits.dailyBudgetUsd * 1_000_000) {
      this.log.error({ alert: 'ai_budget_exhausted' }, 'AI daily budget exhausted');
      throw budgetExceeded();
    }
  }

  async record(usage: AiUsage, context: UsageContext, limits: AiLimits): Promise<void> {
    const now = new Date();
    const day = utcDay(now);
    const record: AiUsageRecord = {
      day,
      kind: context.kind,
      provider: usage.provider,
      model: usage.model,
      costUsdMicros: usage.costUsdMicros,
      ownerUid: context.ownerUid,
      bookId: context.bookId,
      orderId: null,
      at: now,
    };
    const batch = this.db.batch();
    batch.create(this.db.collection(COLLECTIONS.aiUsage).doc(), record);
    batch.set(
      this.dayRef(day),
      {
        spentUsdMicros: FieldValue.increment(usage.costUsdMicros),
        calls: FieldValue.increment(1),
        updatedAt: now,
      },
      { merge: true },
    );
    if (context.bookId) {
      batch.update(this.db.collection(COLLECTIONS.books).doc(context.bookId), {
        aiCostUsdMicros: FieldValue.increment(usage.costUsdMicros),
      });
    }
    await batch.commit();
    if (usage.costUsdMicros > 0) await this.maybeAlert(day, limits);
  }

  /** Avisa una sola vez por día al pasar el porcentaje de alerta. */
  private async maybeAlert(day: string, limits: AiLimits): Promise<void> {
    const threshold = (limits.dailyBudgetUsd * 1_000_000 * limits.budgetAlertPercent) / 100;
    const ref = this.dayRef(day);
    const crossed = await this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const spent = Number(snapshot.get('spentUsdMicros') ?? 0);
      if (spent < threshold || snapshot.get('alertSent') === true) return null;
      tx.update(ref, { alertSent: true });
      return spent;
    });
    if (crossed !== null) {
      this.log.error(
        {
          alert: 'ai_budget_threshold',
          spentUsd: crossed / 1_000_000,
          dailyBudgetUsd: limits.dailyBudgetUsd,
        },
        `AI spend passed ${String(limits.budgetAlertPercent)}% of the daily budget`,
      );
    }
  }
}
