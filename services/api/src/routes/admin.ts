import {
  COLLECTIONS,
  GLOBAL_DOC_ID,
  apiRoutes,
  type AdminAuditEntry,
  type SiteConfig,
} from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import { actorLabel, auditedWrite } from '../admin/audit';
import { addRoute } from '../plugins/route';

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate();
  }
  return null;
}

/**
 * Base del panel (fase 14): interruptor general del sitio y registro de auditoría. La API y la
 * web leen siteConfig en vivo (listener y revalidación de segundos), así que no hay redeploy.
 */
export function registerAdminRoutes(app: FastifyInstance, db: Firestore): void {
  const siteRef = db.collection(COLLECTIONS.siteConfig).doc(GLOBAL_DOC_ID);

  async function site() {
    const data = (await siteRef.get()).data() ?? {};
    return {
      mode: (data.mode as SiteConfig['mode'] | undefined) ?? 'live',
      updatedAt: toDate(data.updatedAt)?.toISOString() ?? null,
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
    };
  }

  addRoute(app, apiRoutes.adminSiteConfig, {}, site);

  addRoute(app, apiRoutes.updateSiteConfig, {}, async (request) => {
    const { mode } = request.body as { mode: SiteConfig['mode'] };
    const before = await site();
    const config: SiteConfig = { mode, updatedAt: new Date(), updatedBy: actorLabel(request.user) };
    await auditedWrite(
      db,
      request.user,
      {
        action: 'site_config.update',
        entity: COLLECTIONS.siteConfig,
        entityId: GLOBAL_DOC_ID,
        before: { mode: before.mode },
        after: { mode },
      },
      (batch) => batch.set(siteRef, config),
    );
    return site();
  });

  addRoute(app, apiRoutes.adminAuditLog, {}, async (request) => {
    const query = request.query as { entity?: string; before?: string; limit: number };
    let ref = db.collection(COLLECTIONS.auditLog).orderBy('at', 'desc');
    if (query.entity) ref = ref.where('entity', '==', query.entity);
    if (query.before) ref = ref.where('at', '<', new Date(query.before));
    const snapshot = await ref.limit(query.limit).get();
    const entries: AdminAuditEntry[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        actorEmail: (data.actorEmail as string | null | undefined) ?? null,
        action: data.action as string,
        entity: data.entity as string,
        entityId: data.entityId as string,
        before: (data.before as Record<string, unknown> | null | undefined) ?? null,
        after: (data.after as Record<string, unknown> | null | undefined) ?? null,
        at: toDate(data.at)?.toISOString() ?? new Date(0).toISOString(),
      };
    });
    return { entries };
  });
}
