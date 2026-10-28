import { COLLECTIONS, GLOBAL_DOC_ID, apiRoutes, type AiConfig } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import type { z } from 'zod';

import { actorLabel, auditedWrite } from '../admin/audit';
import { AiBudget } from '../ai/budget';
import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

type UpdateBody = z.output<(typeof apiRoutes)['updateAiConfig']['body']>;

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate();
  }
  return null;
}

/**
 * Configuración de IA: los admins la ven; solo el superadmin la cambia. El cambio se aplica
 * en vivo (la API escucha aiConfig) y queda en auditLog con el antes y el después.
 */
export function registerAiConfigRoutes(app: FastifyInstance, db: Firestore): void {
  const { providers } = app.deps;
  const budget = new AiBudget(db, app.log);
  const ref = db.collection(COLLECTIONS.aiConfig).doc(GLOBAL_DOC_ID);

  async function current() {
    const data = (await ref.get()).data() ?? {};
    const limits = await budget.limits();
    return {
      config: {
        ...limits,
        updatedAt: toDate(data.updatedAt)?.toISOString() ?? null,
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
      },
      spentTodayUsd: (await budget.spentTodayUsdMicros()) / 1_000_000,
      available: { text: providers.available('aiText'), image: providers.available('aiImage') },
    };
  }

  addRoute(app, apiRoutes.adminAiConfig, {}, current);

  addRoute(app, apiRoutes.updateAiConfig, {}, async (request) => {
    const changes = request.body as UpdateBody;
    const before = await budget.limits();
    const after = { ...before, ...changes };

    for (const [kind, id] of [
      ['aiText', after.textProvider],
      ['aiImage', after.imageProvider],
    ] as const) {
      if (!providers.available(kind).includes(id)) {
        throw new AppError(
          400,
          'validation_failed',
          `El proveedor "${id}" no está disponible en este ambiente.`,
        );
      }
    }
    // Un proveedor real con un modelo simulado fallaría en la primera llamada.
    if (
      (after.textProvider !== 'mock' && after.textModel.startsWith('mock')) ||
      (after.imageProvider !== 'mock' && after.imageModel.startsWith('mock'))
    ) {
      throw new AppError(400, 'validation_failed', 'Elige un modelo real para ese proveedor.');
    }

    const config: AiConfig = {
      ...after,
      updatedAt: new Date(),
      updatedBy: actorLabel(request.user),
    };
    await auditedWrite(
      db,
      request.user,
      {
        action: 'ai_config.update',
        entity: COLLECTIONS.aiConfig,
        entityId: GLOBAL_DOC_ID,
        before: { ...before },
        after: { ...after },
      },
      (batch) => batch.set(ref, config),
    );
    // Se aplica ya en esta instancia; las demás lo toman del listener.
    providers.setAiOverride({
      text: after.textProvider,
      image: after.imageProvider,
      textModel: after.textModel,
      imageModel: after.imageModel,
    });
    return current();
  });
}
