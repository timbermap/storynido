import { COLLECTIONS, previewPaths, type StorageService } from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

const DAY = 24 * 3600 * 1000;
/** Una sesión anónima sin actividad por más de esto se considera abandonada. */
export const ABANDONED_AFTER_DAYS = 30;

/** Lo que el job necesita de Firebase Auth. */
export interface AnonymousAuth {
  /** null si el usuario ya no existe (por ejemplo, Identity Platform borró la sesión anónima). */
  getUser(uid: string): Promise<{ anonymous: boolean; lastActive: Date | null } | null>;
  deleteUser(uid: string): Promise<void>;
}

/**
 * Borra lo que dejó una sesión anónima abandonada (el creador sin cuenta): borradores, perfiles de
 * chicos y fotos, más la sesión. Corre una vez por día. Nunca toca a un usuario con cuenta, a una
 * sesión usada en los últimos 30 días ni a nadie con pedidos.
 */
export class AnonymousCleanup {
  constructor(
    private readonly db: Firestore,
    private readonly auth: AnonymousAuth,
    private readonly storage: () => StorageService,
    private readonly log: FastifyBaseLogger,
  ) {}

  async run(now = new Date(), limit = 500): Promise<{ owners: number; books: number }> {
    const cutoff = new Date(now.getTime() - ABANDONED_AFTER_DAYS * DAY);
    const stale = await this.db
      .collection(COLLECTIONS.books)
      .where('updatedAt', '<', cutoff)
      .select('ownerUid')
      .limit(limit)
      .get();
    const owners = [...new Set(stale.docs.map((doc) => doc.get('ownerUid') as string))];
    let cleaned = 0;
    let books = 0;
    for (const uid of owners) {
      if (!(await this.abandoned(uid, cutoff))) continue;
      books += await this.erase(uid);
      cleaned += 1;
    }
    if (cleaned > 0)
      this.log.info({ owners: cleaned, books }, 'sesiones anónimas abandonadas borradas');
    return { owners: cleaned, books };
  }

  private async abandoned(uid: string, cutoff: Date): Promise<boolean> {
    const user = await this.auth.getUser(uid);
    if (user && (!user.anonymous || (user.lastActive && user.lastActive >= cutoff))) return false;
    // Con algún libro reciente, la sesión sigue en uso (se filtra acá: sin índice compuesto).
    const books = await this.db
      .collection(COLLECTIONS.books)
      .where('ownerUid', '==', uid)
      .select('updatedAt')
      .get();
    const recent = books.docs.some((doc) => {
      const updated = doc.get('updatedAt') as { toDate(): Date } | Date | null;
      const date = updated instanceof Date ? updated : (updated?.toDate() ?? null);
      return !date || date >= cutoff;
    });
    if (recent) return false;
    const orders = await this.db
      .collection(COLLECTIONS.orders)
      .where('ownerUid', '==', uid)
      .limit(1)
      .get();
    return orders.empty;
  }

  private async erase(uid: string): Promise<number> {
    const storage = this.storage();
    const owned = (name: string) => this.db.collection(name).where('ownerUid', '==', uid).get();

    for (const doc of (await owned(COLLECTIONS.photos)).docs) {
      for (const path of [doc.get('storagePath'), doc.get('processedPath')]) {
        if (typeof path === 'string') await storage.delete({ bucket: 'photos', path });
      }
      await doc.ref.delete();
    }
    const books = (await owned(COLLECTIONS.books)).docs;
    for (const doc of books) {
      for (const path of previewPaths(doc.get('preview'))) {
        await storage.delete({ bucket: 'assets', path });
      }
      await this.db.recursiveDelete(doc.ref);
    }
    for (const doc of (await owned(COLLECTIONS.children)).docs) await doc.ref.delete();
    await this.db.collection(COLLECTIONS.users).doc(uid).delete();
    await this.auth.deleteUser(uid).catch(() => undefined);
    return books.length;
  }
}
