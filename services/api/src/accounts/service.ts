import { COLLECTIONS, type AuditLogEntry } from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import type { TokenVerifier } from '../deps';
import { AppError } from '../errors';

/** Colecciones con datos del usuario que se traspasan al vincular la cuenta. */
const OWNED = ['books', 'children', 'photos', 'consents'] as const;
type Owned = (typeof OWNED)[number];

/** Borra usuarios de Firebase Auth (en los tests, un doble). */
export interface AuthAccounts {
  deleteUser(uid: string): Promise<void>;
}

/**
 * Cuentas: el creador funciona sin cuenta con una sesión anónima. Si al iniciar sesión el
 * mail ya tenía una cuenta, la sesión no se puede vincular y sus datos se traspasan acá.
 */
export class AccountService {
  constructor(
    private readonly db: Firestore,
    private readonly tokens: TokenVerifier,
    private readonly auth: AuthAccounts,
  ) {}

  async mergeAnonymous(
    target: { uid: string; email: string | null },
    anonymousIdToken: string,
  ): Promise<Record<Owned, number>> {
    let anonymousUid: string;
    try {
      const verified = await this.tokens.verify(anonymousIdToken);
      const firebase = verified.claims.firebase as { sign_in_provider?: unknown } | undefined;
      if (firebase?.sign_in_provider !== 'anonymous') throw new Error('no anónimo');
      anonymousUid = verified.uid;
    } catch {
      throw new AppError(400, 'bad_request', 'La sesión anterior no es válida o ya venció.');
    }
    if (anonymousUid === target.uid) {
      return { books: 0, children: 0, photos: 0, consents: 0 };
    }

    const moved = { books: 0, children: 0, photos: 0, consents: 0 };
    const writer = this.db.bulkWriter();
    for (const name of OWNED) {
      const snapshot = await this.db
        .collection(COLLECTIONS[name])
        .where('ownerUid', '==', anonymousUid)
        .get();
      for (const doc of snapshot.docs) {
        // Los consentimientos conservan quién los dio originalmente.
        void writer.update(
          doc.ref,
          name === 'consents'
            ? { ownerUid: target.uid, transferredFromUid: anonymousUid }
            : { ownerUid: target.uid },
        );
      }
      moved[name] = snapshot.size;
    }
    await writer.close();

    const audit: AuditLogEntry = {
      actorUid: target.uid,
      actorEmail: target.email,
      action: 'account.merge_anonymous',
      entity: 'users',
      entityId: target.uid,
      before: { uid: anonymousUid },
      after: { uid: target.uid, ...moved },
      at: new Date(),
    };
    await this.db.collection(COLLECTIONS.auditLog).add(audit);
    // Si el borrado falla, la sesión anónima ya no tiene datos asociados.
    await this.auth.deleteUser(anonymousUid).catch(() => undefined);
    return moved;
  }
}
