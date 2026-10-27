import type { ProviderRegistry } from '@storynido/providers';
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
    private readonly providers: ProviderRegistry,
  ) {}

  // ------------------------------------------------------------ privacidad

  /**
   * Borra a pedido los datos de un chico: perfil, fotos (archivos y registros) y libros que
   * no se pidieron, con sus imágenes de vista previa. Los libros ya pagados se conservan
   * (entrega y contabilidad); sus fotos igual se borran. Queda en auditoría y llega un mail.
   */
  async deleteChild(
    user: { uid: string; email: string | null },
    childId: string,
    options: { notify?: boolean } = {},
  ): Promise<{ photos: number; books: number; keptOrderedBooks: number }> {
    const childRef = this.db.collection(COLLECTIONS.children).doc(childId);
    const child = (await childRef.get()).data();
    if (child?.ownerUid !== user.uid) throw new AppError(404, 'not_found', 'Perfil inexistente.');
    const storage = this.providers.storage();

    const photos = await this.db
      .collection(COLLECTIONS.photos)
      .where('ownerUid', '==', user.uid)
      .where('childId', '==', childId)
      .get();
    for (const doc of photos.docs) {
      for (const path of [doc.get('storagePath'), doc.get('processedPath')]) {
        if (typeof path === 'string') await storage.delete({ bucket: 'photos', path });
      }
      await doc.ref.delete();
    }

    const books = await this.db
      .collection(COLLECTIONS.books)
      .where('ownerUid', '==', user.uid)
      .where('childId', '==', childId)
      .get();
    let deletedBooks = 0;
    let kept = 0;
    for (const doc of books.docs) {
      if (doc.get('status') === 'ordered') {
        kept += 1;
        continue;
      }
      for (const path of previewPaths(doc.get('preview'))) {
        await storage.delete({ bucket: 'assets', path });
      }
      await this.db.recursiveDelete(doc.ref);
      deletedBooks += 1;
    }
    await childRef.delete();

    await this.audit(user, 'privacy.delete_child', childId, {
      photos: photos.size,
      books: deletedBooks,
      keptOrderedBooks: kept,
    });
    if (options.notify !== false)
      await this.notifyDeleted(user, `delete-child:${childId}`, 'child');
    return { photos: photos.size, books: deletedBooks, keptOrderedBooks: kept };
  }

  /** Borra la cuenta: cada chico, las fotos y borradores sueltos, el perfil y el acceso. */
  async deleteAccount(user: { uid: string; email: string | null }): Promise<{ deleted: true }> {
    const children = await this.db
      .collection(COLLECTIONS.children)
      .where('ownerUid', '==', user.uid)
      .get();
    for (const doc of children.docs) await this.deleteChild(user, doc.id, { notify: false });

    const storage = this.providers.storage();
    const photos = await this.db
      .collection(COLLECTIONS.photos)
      .where('ownerUid', '==', user.uid)
      .get();
    for (const doc of photos.docs) {
      for (const path of [doc.get('storagePath'), doc.get('processedPath')]) {
        if (typeof path === 'string') await storage.delete({ bucket: 'photos', path });
      }
      await doc.ref.delete();
    }
    const books = await this.db
      .collection(COLLECTIONS.books)
      .where('ownerUid', '==', user.uid)
      .get();
    for (const doc of books.docs) {
      if (doc.get('status') === 'ordered') continue;
      for (const path of previewPaths(doc.get('preview'))) {
        await storage.delete({ bucket: 'assets', path });
      }
      await this.db.recursiveDelete(doc.ref);
    }
    // El mail de constancia sale antes de borrar el perfil (de ahí sale el idioma).
    await this.notifyDeleted(user, `delete-account:${user.uid}`, 'account');
    await this.db.collection(COLLECTIONS.users).doc(user.uid).delete();
    await this.audit(user, 'privacy.delete_account', user.uid, { children: children.size });
    await this.auth.deleteUser(user.uid);
    return { deleted: true };
  }

  private async audit(
    user: { uid: string; email: string | null },
    action: string,
    entityId: string,
    after: Record<string, unknown>,
  ) {
    const entry: AuditLogEntry = {
      actorUid: user.uid,
      actorEmail: user.email,
      action,
      entity: action === 'privacy.delete_account' ? COLLECTIONS.users : COLLECTIONS.children,
      entityId,
      before: null,
      after,
      at: new Date(),
    };
    await this.db.collection(COLLECTIONS.auditLog).add(entry);
  }

  private async notifyDeleted(
    user: { uid: string; email: string | null },
    idempotencyKey: string,
    scope: 'child' | 'account',
  ) {
    if (!user.email) return;
    const profile = (await this.db.collection(COLLECTIONS.users).doc(user.uid).get()).data();
    const saved: unknown = profile?.locale;
    const locale = saved === 'en' || saved === 'pt' ? saved : 'es';
    await this.providers.email().send({
      to: user.email,
      template: 'data_deleted',
      locale,
      data: { scope },
      idempotencyKey,
    });
  }

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

/** Rutas de las imágenes de la vista previa guardadas en el libro. */
function previewPaths(preview: unknown): string[] {
  if (!preview || typeof preview !== 'object') return [];
  const value = preview as {
    character?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    cover?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    pages?: { imagePath?: unknown; previewImagePath?: unknown }[];
  };
  return [value.character, value.cover, ...(value.pages ?? [])].flatMap((item) =>
    [item?.imagePath, item?.previewImagePath].filter(
      (path): path is string => typeof path === 'string',
    ),
  );
}
