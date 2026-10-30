import {
  ADMIN_CONFIG,
  adminConfigStamps,
  COLLECTIONS,
  GLOBAL_DOC_ID,
  apiRoutes,
  expectedDocId,
  normalizeFirestoreData,
  sumMetrics,
  type AdminAuditEntry,
  type AdminConfigKind,
  type SiteConfig,
} from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import { actorLabel, auditedWrite } from '../admin/audit';
import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

/** Firestore no guarda `undefined`: se quitan los campos opcionales vacíos (las fechas quedan). */
function withoutUndefined(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(withoutUndefined);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, inner]) => inner !== undefined)
      .map(([key, inner]) => [key, withoutUndefined(inner)]),
  );
}

const asRecord = (value: unknown) => normalizeFirestoreData(value) as Record<string, unknown>;

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

  // Configuración del negocio (etapa 2): un mismo par de rutas para cada tipo, validado con
  // su esquema y auditado. El catálogo de la API la toma en menos de un minuto (cache).
  addRoute(app, apiRoutes.adminConfigList, {}, async (request) => {
    const { kind } = request.params as { kind: AdminConfigKind };
    const snapshot = await db.collection(ADMIN_CONFIG[kind].collection).get();
    return { items: snapshot.docs.map((doc) => ({ id: doc.id, data: asRecord(doc.data()) })) };
  });

  addRoute(app, apiRoutes.adminConfigSave, {}, async (request) => {
    const { kind, id } = request.params as { kind: AdminConfigKind; id: string };
    // El catálogo de modelos de IA decide qué recibe los datos de los chicos: solo el superadmin.
    if (kind === 'aiModels' && request.user?.role !== 'superadmin') {
      throw new AppError(
        403,
        'forbidden',
        'Solo el superadmin cambia el catálogo de modelos de IA.',
      );
    }
    const parsed = ADMIN_CONFIG[kind].input.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError(
        400,
        'validation_failed',
        `${issue?.path.length ? issue.path.join('.') : 'Datos'}: ${issue?.message ?? 'inválidos'}`,
      );
    }
    const expected = expectedDocId(kind, parsed.data);
    if (expected !== null && expected !== id) {
      throw new AppError(400, 'validation_failed', `El id tiene que ser "${expected}".`);
    }
    const ref = db.collection(ADMIN_CONFIG[kind].collection).doc(id);
    const existing = (await ref.get()).data();
    const before = existing ? asRecord(existing) : null;
    const now = new Date();
    const stamps = adminConfigStamps(kind);
    const data = withoutUndefined({
      ...parsed.data,
      // Lo que no edita el admin: cuándo se creó, quién lo cambió y cuántas veces se usó un cupón.
      ...(stamps.createdAt ? { createdAt: before?.createdAt ?? now } : {}),
      ...(stamps.updatedBy ? { updatedBy: actorLabel(request.user) } : {}),
      ...(kind === 'coupons' ? { redemptions: before?.redemptions ?? 0 } : {}),
      updatedAt: now,
    }) as Record<string, unknown>;
    await auditedWrite(
      db,
      request.user,
      {
        action: `${kind}.${before ? 'update' : 'create'}`,
        entity: ADMIN_CONFIG[kind].collection,
        entityId: id,
        before,
        after: data,
      },
      (batch) => batch.set(ref, data),
    );
    return { id, data };
  });

  // Dashboard: días cerrados precalculados (metricsDaily) y hoy en vivo.
  addRoute(app, apiRoutes.adminMetrics, {}, async (request) => {
    const { days } = request.query as { days: number };
    const list = await app.deps.metrics.range(days);
    // Login por navegador: suma de los contadores diarios del rango.
    const refs = list.map((day) => db.collection(COLLECTIONS.loginMetrics).doc(day.day));
    const logins: Record<string, number> = {};
    for (const snapshot of refs.length ? await db.getAll(...refs) : []) {
      const counts = (snapshot.get('counts') ?? {}) as Record<string, number>;
      for (const [key, value] of Object.entries(counts)) logins[key] = (logins[key] ?? 0) + value;
    }
    return { days: list, totals: { ...sumMetrics(list), logins } };
  });

  addRoute(app, apiRoutes.adminAiCosts, {}, async (request) => {
    const { days } = request.query as { days: number };
    return app.deps.metrics.aiCosts(days);
  });

  addRoute(app, apiRoutes.adminAuditLog, {}, async (request) => {
    const query = request.query as {
      entity?: string;
      actor?: string;
      from?: string;
      before?: string;
      limit: number;
    };
    let ref = db.collection(COLLECTIONS.auditLog).orderBy('at', 'desc');
    if (query.entity) ref = ref.where('entity', '==', query.entity);
    else if (query.actor) ref = ref.where('actorEmail', '==', query.actor.trim().toLowerCase());
    if (query.from) ref = ref.where('at', '>=', new Date(query.from));
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
        // Las fechas guardadas en el antes y el después vuelven como fechas (ISO), no Timestamps.
        before: data.before ? asRecord(data.before) : null,
        after: data.after ? asRecord(data.after) : null,
        at: toDate(data.at)?.toISOString() ?? new Date(0).toISOString(),
      };
    });
    return { entries };
  });
}
