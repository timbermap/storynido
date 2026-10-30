import {
  COLLECTIONS,
  REVENUE_ORDER_STATUSES,
  apiRoutes,
  normalizeFirestoreData,
  type OrderStatus,
  type Role,
} from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { AppError } from '../errors';
import { addRoute } from '../plugins/route';
import { toOrderSummary } from './admin-orders';

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);

/**
 * Clientes y usuarios del panel (fase 15). De los chicos solo se muestra cuántos perfiles hay:
 * nunca nombres, edades ni fotos.
 */
export function registerAdminPeopleRoutes(app: FastifyInstance): void {
  const { db, accounts, pro } = app.deps;

  async function customer(doc: DocumentSnapshot) {
    const data = normalizeFirestoreData(doc.data() ?? {}) as Record<string, unknown>;
    const [orders, children] = await Promise.all([
      db.collection(COLLECTIONS.orders).where('ownerUid', '==', doc.id).get(),
      db.collection(COLLECTIONS.children).where('ownerUid', '==', doc.id).count().get(),
    ]);
    const spentByCurrency: Record<string, number> = {};
    let sold = 0;
    for (const order of orders.docs) {
      if (!REVENUE_ORDER_STATUSES.includes(order.get('status') as OrderStatus)) continue;
      sold += 1;
      const currency = String(order.get('currency'));
      spentByCurrency[currency] =
        (spentByCurrency[currency] ?? 0) + Number(order.get('amounts.totalMinor') ?? 0);
    }
    return {
      summary: {
        uid: doc.id,
        email: (data.email as string | null | undefined) ?? null,
        createdAt: iso(data.createdAt),
        accountType: typeof data.accountType === 'string' ? data.accountType : 'family',
        role: typeof data.role === 'string' ? data.role : 'customer',
        orders: sold,
        spentByCurrency,
        children: children.data().count,
      },
      orders,
    };
  }

  addRoute(app, apiRoutes.adminCustomers, {}, async (request) => {
    const { q } = request.query as { q?: string };
    const users = db.collection(COLLECTIONS.users);
    const snapshot = q
      ? await users.where('email', '==', q.trim().toLowerCase()).limit(5).get()
      : await users.orderBy('createdAt', 'desc').limit(50).get();
    const list = await Promise.all(snapshot.docs.map(async (doc) => (await customer(doc)).summary));
    return { customers: list };
  });

  addRoute(app, apiRoutes.adminCustomerDetail, {}, async (request) => {
    const { uid } = request.params as { uid: string };
    const doc = await db.collection(COLLECTIONS.users).doc(uid).get();
    if (!doc.exists) throw new AppError(404, 'not_found', 'Cliente inexistente.');
    const { summary, orders } = await customer(doc);
    const status = await pro.status(uid);
    const requests = await db.collection(COLLECTIONS.privacyRequests).where('uid', '==', uid).get();
    return {
      ...summary,
      ordersList: orders.docs
        .map((order) => toOrderSummary(order, summary.email))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
      pro: {
        purchases: status.discount.purchases,
        digitalPercent: status.discount.digitalPercent,
        printPercent: status.discount.printPercent,
        windowDays: status.discount.windowDays,
      },
      privacyRequests: requests.docs.map((entry) => {
        const data = normalizeFirestoreData(entry.data()) as Record<string, unknown>;
        return {
          requestedBy: (data.requestedBy as string | null | undefined) ?? null,
          completedAt: iso(data.completedAt),
          result: (data.result as Record<string, number> | undefined) ?? {},
        };
      }),
    };
  });

  addRoute(app, apiRoutes.adminEraseCustomerData, {}, async (request) => {
    const { uid } = request.params as { uid: string };
    if (!request.user) throw new AppError(401, 'unauthorized', 'Inicia sesión.');
    return accounts.adminEraseChildData(request.user, uid);
  });

  addRoute(app, apiRoutes.adminStaff, {}, async () => {
    const snapshot = await db
      .collection(COLLECTIONS.users)
      .where('role', 'in', ['admin', 'superadmin'])
      .get();
    return {
      staff: snapshot.docs.map((doc) => ({
        uid: doc.id,
        email: (doc.get('email') as string | null | undefined) ?? null,
        role: doc.get('role') as Role,
      })),
    };
  });

  addRoute(app, apiRoutes.adminSetStaffRole, {}, async (request) => {
    const { email, role } = request.body as { email: string; role: Role };
    if (!request.user) throw new AppError(401, 'unauthorized', 'Inicia sesión.');
    return accounts.setStaffRole(request.user, email, role);
  });
}
