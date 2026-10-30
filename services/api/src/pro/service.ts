import {
  COLLECTIONS,
  REVENUE_ORDER_STATUSES,
  type OrderStatus,
  type ProDiscountConfig,
  type ProProfile,
  proPercent,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import type { CatalogRepository } from '../catalog';
import { AppError } from '../errors';

/**
 * Descuento por volumen y recurrencia (fase 12c): el perfil profesional lo activa la API (el
 * cliente no puede cambiar su tipo de cuenta) y el descuento se calcula acá, contando las
 * compras elegibles de cualquier cuenta.
 */
export class ProService {
  constructor(
    private readonly db: Firestore,
    private readonly catalog: CatalogRepository,
  ) {}

  async activate(user: { uid: string; anonymous: boolean }, profile: ProProfile) {
    if (user.anonymous) throw new AppError(403, 'account_required', 'Inicia sesión con tu cuenta.');
    await this.db
      .collection(COLLECTIONS.users)
      .doc(user.uid)
      .set(
        {
          accountType: 'professional',
          proProfile: {
            ...profile,
            professionOther: profile.profession === 'other' ? profile.professionOther : null,
          },
          updatedAt: new Date(),
        },
        { merge: true },
      );
    return { accountType: 'professional' as const };
  }

  /** Compras elegibles de la cuenta en la ventana (cada pedido cuenta una sola vez). */
  async purchases(uid: string, config: ProDiscountConfig, now = new Date()) {
    const since = new Date(now.getTime() - config.windowDays * 24 * 3600 * 1000);
    const orders = await this.db
      .collection(COLLECTIONS.orders)
      .where('ownerUid', '==', uid)
      .where('createdAt', '>=', since)
      .get();
    return orders.docs.filter((doc) =>
      REVENUE_ORDER_STATUSES.includes(doc.get('status') as OrderStatus),
    ).length;
  }

  /**
   * Para el checkout: las compras de la cuenta (el descuento por volumen y recurrencia es de
   * todos) y si tiene el perfil profesional (que suma el descuento base del producto).
   */
  async context(
    uid: string,
  ): Promise<{ purchases: number; config: ProDiscountConfig; professional: boolean }> {
    const user = (await this.db.collection(COLLECTIONS.users).doc(uid).get()).data();
    const config = await this.catalog.proDiscounts();
    return {
      purchases: await this.purchases(uid, config),
      config,
      professional: user?.accountType === 'professional',
    };
  }

  /** Estado de la cuenta: compras elegibles, descuento actual y el próximo escalón (de todos). */
  async status(uid: string) {
    const user = (await this.db.collection(COLLECTIONS.users).doc(uid).get()).data();
    const config = await this.catalog.proDiscounts();
    const purchases = await this.purchases(uid, config);
    const next = [...config.tiers]
      .sort((a, b) => a.minPurchases - b.minPurchases)
      .find((tier) => tier.minPurchases > purchases);
    const professional = user?.accountType === 'professional';
    return {
      accountType: professional ? ('professional' as const) : ('family' as const),
      proProfile: professional
        ? ((user.proProfile as ProProfile | null | undefined) ?? null)
        : null,
      discount: {
        windowDays: config.windowDays,
        purchases,
        digitalPercent: proPercent(purchases, config, 'digital'),
        printPercent: proPercent(purchases, config, 'softcover'),
        next: next ? { purchases: next.minPurchases, percent: next.percent } : null,
      },
    };
  }
}
