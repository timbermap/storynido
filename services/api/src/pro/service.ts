import {
  COLLECTIONS,
  type OrderStatus,
  type ProDiscountConfig,
  type ProProfile,
  proPercent,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import type { CatalogRepository } from '../catalog';
import { AppError } from '../errors';

/** Pedidos que cuentan para el descuento: pagados y no reembolsados ni cancelados. */
const ELIGIBLE: readonly OrderStatus[] = [
  'paid',
  'generating',
  'ready',
  'qa_failed',
  'sent_to_print',
  'in_production',
  'shipped',
  'delivered',
];

/**
 * StoryNido Profesionales (fase 12c): la cuenta Pro la activa la API (el cliente no puede
 * cambiar su tipo de cuenta) y el descuento se calcula acá, contando compras elegibles.
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
    return orders.docs.filter((doc) => ELIGIBLE.includes(doc.get('status') as OrderStatus)).length;
  }

  /** Para el checkout: null si la cuenta es de Familia (el precio de Familias de siempre). */
  async context(uid: string): Promise<{ purchases: number; config: ProDiscountConfig } | null> {
    const user = (await this.db.collection(COLLECTIONS.users).doc(uid).get()).data();
    if (user?.accountType !== 'professional') return null;
    const config = await this.catalog.proDiscounts();
    return { purchases: await this.purchases(uid, config), config };
  }

  /** Estado para "Mi cuenta" Pro: compras elegibles, descuento actual y el próximo escalón. */
  async status(uid: string) {
    const user = (await this.db.collection(COLLECTIONS.users).doc(uid).get()).data();
    const config = await this.catalog.proDiscounts();
    if (user?.accountType !== 'professional') {
      return { accountType: 'family' as const, proProfile: null, discount: null };
    }
    const purchases = await this.purchases(uid, config);
    const next = [...config.tiers]
      .sort((a, b) => a.minPurchases - b.minPurchases)
      .find((tier) => tier.minPurchases > purchases);
    return {
      accountType: 'professional' as const,
      proProfile: (user.proProfile as ProProfile | null | undefined) ?? null,
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
