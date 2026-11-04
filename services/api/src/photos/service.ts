import { cropPortrait, normalizeImage, type ProviderRegistry } from '@storynido/providers';
import {
  COLLECTIONS,
  GUARDIAN_CONSENT_VERSION,
  PHOTO_CONSENT_VERSION,
  PHOTO_RULES,
  ProviderError,
  evaluatePhoto,
  type Locale,
  type Photo,
  type PhotoRejectionReason,
  type PublicPhoto,
} from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { AiBudget } from '../ai/budget';
import { AppError } from '../errors';

const UPLOAD_URL_SECONDS = 10 * 60;
const PREVIEW_URL_SECONDS = 15 * 60;
const RETENTION_DAYS = 30;
const EDITABLE_BOOK_STATUSES = new Set(['draft', 'preview_ready']);

const notFound = () => new AppError(404, 'not_found', 'No encontramos esa foto o borrador.');

/**
 * Fotos del protagonista: consentimiento, subida con URL firmada, validación,
 * procesamiento y borrado. Todo lo escribe el servidor (las reglas lo impiden al cliente).
 */
export class PhotoService {
  private readonly budget: AiBudget;

  constructor(
    private readonly db: Firestore,
    private readonly providers: ProviderRegistry,
    private readonly log: FastifyBaseLogger,
  ) {
    this.budget = new AiBudget(db, log);
  }

  async recordConsent(input: {
    uid: string;
    type?: 'photo_upload' | 'guardian_authorization';
    textVersion: string;
    locale: Locale;
    ip: string;
    userAgent: string | null;
  }): Promise<string> {
    const type = input.type ?? 'photo_upload';
    const version = type === 'photo_upload' ? PHOTO_CONSENT_VERSION : GUARDIAN_CONSENT_VERSION;
    if (input.textVersion !== version) {
      throw new AppError(
        409,
        'bad_request',
        'El texto del consentimiento cambió. Recarga la página y vuelve a aceptarlo.',
      );
    }
    const ref = await this.db.collection(COLLECTIONS.consents).add({
      ownerUid: input.uid,
      type,
      textVersion: input.textVersion,
      locale: input.locale,
      acceptedAt: new Date(),
      ip: input.ip,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
    });
    return ref.id;
  }

  async createUpload(input: {
    uid: string;
    bookId?: string;
    /** Sin cuento: la foto es solo para el personaje (su dibujo en el perfil). */
    childId?: string;
    consentId: string;
    contentType: string;
  }): Promise<{
    photoId: string;
    upload: { url: string; headers: Record<string, string>; expiresAt: string };
  }> {
    const target = input.bookId
      ? await this.bookTarget(input.uid, input.bookId)
      : await this.childTarget(input.uid, input.childId ?? '');

    const consent = (
      await this.db.collection(COLLECTIONS.consents).doc(input.consentId).get()
    ).data();
    if (
      consent?.ownerUid !== input.uid ||
      consent.type !== 'photo_upload' ||
      consent.textVersion !== PHOTO_CONSENT_VERSION
    ) {
      throw new AppError(403, 'forbidden', 'Necesitamos tu consentimiento antes de subir fotos.');
    }
    // Libros de Profesionales: la foto es de un chico que no es propio; hace falta la
    // declaración de que tienen la autorización de su madre, padre o tutor. Un profesional que
    // hace un cuento de Familia para su propio hijo no la necesita (va por la línea del libro).
    if (target.channel === 'professionals') {
      const guardian = await this.db
        .collection(COLLECTIONS.consents)
        .where('ownerUid', '==', input.uid)
        .where('type', '==', 'guardian_authorization')
        .where('textVersion', '==', GUARDIAN_CONSENT_VERSION)
        .limit(1)
        .get();
      if (guardian.empty) {
        throw new AppError(
          403,
          'forbidden',
          'Antes de subir la foto, confirma que tienes la autorización de su madre, padre o tutor.',
        );
      }
    }

    const existing = await this.db
      .collection(COLLECTIONS.photos)
      .where('ownerUid', '==', input.uid)
      .where(target.bookId ? 'bookId' : 'childId', '==', target.bookId ?? target.childId)
      .get();
    const active = existing.docs.filter(
      (doc) =>
        doc.get('status') !== 'rejected' && (target.bookId !== null || doc.get('bookId') === null),
    );
    // Las fotos de un personaje reutilizado (de su cuento anterior) también cuentan para el límite.
    const own = new Set(existing.docs.map((doc) => doc.id));
    const reused = await this.reusedPhotos(
      input.uid,
      target.photoIds.filter((id) => !own.has(id)),
    );
    if (active.length + reused.length >= PHOTO_RULES.maxPhotosPerBook) {
      throw new AppError(
        409,
        'bad_request',
        `Puedes subir hasta ${String(PHOTO_RULES.maxPhotosPerBook)} fotos.`,
      );
    }

    const ref = this.db.collection(COLLECTIONS.photos).doc();
    const now = new Date();
    const photo: Photo = {
      ownerUid: input.uid,
      bookId: target.bookId,
      childId: target.childId,
      contentType: input.contentType,
      storagePath: `${input.uid}/${target.bookId ?? `child-${target.childId}`}/${ref.id}/original`,
      processedPath: null,
      status: 'pending_upload',
      rejectionReasons: [],
      consentId: input.consentId,
      expiresAt: new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(photo);

    const signed = await this.providers
      .storage()
      .signedUploadUrl(
        { bucket: 'photos', path: photo.storagePath },
        input.contentType,
        UPLOAD_URL_SECONDS,
      );
    return {
      photoId: ref.id,
      upload: {
        url: signed.url,
        headers: signed.headers,
        expiresAt: signed.expiresAt.toISOString(),
      },
    };
  }

  /** Subida para un cuento: el libro tiene que ser propio, editable y con protagonista. */
  private async bookTarget(uid: string, bookId: string) {
    const book = (await this.db.collection(COLLECTIONS.books).doc(bookId).get()).data();
    if (book?.ownerUid !== uid) throw notFound();
    if (!EDITABLE_BOOK_STATUSES.has(String(book.status))) {
      throw new AppError(409, 'bad_request', 'Este libro ya no se puede editar.');
    }
    if (typeof book.childId !== 'string') {
      throw new AppError(409, 'bad_request', 'Completa primero los datos del protagonista.');
    }
    return {
      bookId: bookId as string | null,
      childId: book.childId,
      channel: String(book.channel ?? 'families'),
      photoIds: (book.photoIds as string[] | undefined) ?? [],
    };
  }

  /** Subida solo para el personaje (su dibujo en el perfil): el personaje tiene que ser propio. */
  private async childTarget(uid: string, childId: string) {
    const child = childId
      ? (await this.db.collection(COLLECTIONS.children).doc(childId).get()).data()
      : undefined;
    if (child?.ownerUid !== uid) throw notFound();
    return {
      bookId: null as string | null,
      childId,
      // Un personaje con alias es de Profesionales: pide la autorización del tutor.
      channel: child.alias ? 'professionals' : 'families',
      photoIds: [] as string[],
    };
  }

  private async ownedPhoto(uid: string, photoId: string) {
    const ref = this.db.collection(COLLECTIONS.photos).doc(photoId);
    const snapshot = await ref.get();
    if (snapshot.get('ownerUid') !== uid) throw notFound();
    return { ref, data: snapshot.data() as Photo };
  }

  private async toPublic(id: string, photo: Photo): Promise<PublicPhoto> {
    const previewUrl =
      photo.status === 'valid' && photo.processedPath
        ? (
            await this.providers
              .storage()
              .signedDownloadUrl(
                { bucket: 'photos', path: photo.processedPath },
                PREVIEW_URL_SECONDS,
              )
          ).url
        : null;
    const createdAt = photo.createdAt as Date | { toDate(): Date };
    return {
      id,
      bookId: photo.bookId,
      status: photo.status,
      rejectionReasons: photo.rejectionReasons,
      previewUrl,
      createdAt: (createdAt instanceof Date ? createdAt : createdAt.toDate()).toISOString(),
    };
  }

  async process(uid: string, photoId: string): Promise<PublicPhoto> {
    const { ref, data: photo } = await this.ownedPhoto(uid, photoId);
    if (photo.status !== 'pending_upload') return this.toPublic(photoId, photo);

    const storage = this.providers.storage();
    const original = { bucket: 'photos' as const, path: photo.storagePath };
    if (!(await storage.exists(original))) {
      throw new AppError(409, 'bad_request', 'La foto todavía no terminó de subirse.');
    }

    let reasons: PhotoRejectionReason[];
    let processedPath: string | null = null;
    let extra: Record<string, unknown> = {};
    try {
      const normalized = await normalizeImage(await storage.download(original));
      const analysis = await this.providers.photoAnalyzer().analyze(normalized.bytes);
      reasons = evaluatePhoto(analysis);
      const face = analysis.faces.toSorted((a, b) => b.width * b.height - a.width * a.height)[0];
      if (reasons.length === 0 && face) {
        processedPath = photo.storagePath.replace(/original$/, 'portrait.jpg');
        const portrait = await cropPortrait(
          normalized.bytes,
          face,
          normalized.width,
          normalized.height,
        );
        await storage.upload({ bucket: 'photos', path: processedPath }, portrait, 'image/jpeg');
        // Si la IA no puede leer la foto, se avisa ahora (y no recién al crear la muestra).
        const read = await this.readCharacter(photo, portrait);
        if (read === 'unreadable') reasons = ['unreadable'];
        else if (read) extra = read;
      }
    } catch {
      reasons = ['unsupported_format'];
    }

    const updated: Photo = {
      ...photo,
      ...(reasons.length === 0 ? extra : {}),
      status: reasons.length === 0 ? 'valid' : 'rejected',
      rejectionReasons: reasons,
      processedPath,
      updatedAt: new Date(),
    };

    if (updated.status === 'rejected') {
      // No guardamos fotos de menores que no se van a usar.
      await storage.delete(original);
      await ref.set(updated);
    } else {
      const batch = this.db.batch();
      batch.set(ref, updated);
      if (photo.bookId) {
        batch.update(this.db.collection(COLLECTIONS.books).doc(photo.bookId), {
          photoIds: FieldValue.arrayUnion(photoId),
          updatedAt: new Date(),
        });
      }
      await batch.commit();
    }
    return this.toPublic(photoId, updated);
  }

  /**
   * Pide ahora la ficha del personaje (la misma que pide la muestra, que la reutiliza si está
   * guardada). Devuelve 'unreadable' si la IA rechaza la foto, los campos a guardar si la lee, y
   * null si no se pudo saber (IA caída, presupuesto agotado): en ese caso no se rechaza la foto.
   */
  private async readCharacter(
    photo: Photo,
    portrait: Uint8Array,
  ): Promise<'unreadable' | Record<string, unknown> | null> {
    try {
      const limits = await this.budget.limits();
      await this.budget.ensureAvailable(limits);
      const result = await this.providers
        .ai()
        .text.describeCharacter({ bytes: portrait, mimeType: 'image/jpeg' });
      await this.budget.record(
        result.usage,
        { kind: 'character', ownerUid: photo.ownerUid, bookId: photo.bookId },
        limits,
      );
      return { characterSheet: result.sheet, characterTraits: result.traits };
    } catch (error) {
      if (error instanceof ProviderError && error.message.includes('bloqueado por seguridad')) {
        return 'unreadable';
      }
      this.log.warn({ err: error }, 'could not read character from photo at upload');
      return null;
    }
  }

  /** Fotos de otro cuento del mismo dueño que siguen válidas (las vencidas ya no existen). */
  private async reusedPhotos(uid: string, ids: string[]) {
    if (ids.length === 0) return [];
    const docs = await this.db.getAll(
      ...ids.map((id) => this.db.collection(COLLECTIONS.photos).doc(id)),
    );
    return docs.filter(
      (doc) => doc.exists && doc.get('ownerUid') === uid && doc.get('status') === 'valid',
    );
  }

  async listForBook(uid: string, bookId: string): Promise<PublicPhoto[]> {
    const book = await this.db.collection(COLLECTIONS.books).doc(bookId).get();
    if (book.get('ownerUid') !== uid) throw notFound();
    const snapshot = await this.db
      .collection(COLLECTIONS.photos)
      .where('ownerUid', '==', uid)
      .where('bookId', '==', bookId)
      .get();
    // Personaje reutilizado: sus fotos válidas del cuento anterior están en photoIds con otro
    // bookId. Se muestran para usarlas o elegir otras (las vencidas ya no existen y no salen).
    const own = new Set(snapshot.docs.map((doc) => doc.id));
    const reusedIds = ((book.get('photoIds') as string[] | undefined) ?? []).filter(
      (id) => !own.has(id),
    );
    const reused = await this.reusedPhotos(uid, reusedIds);
    // Las que vencieron (se borran a los 30 días) salen del libro: se piden nuevas como siempre.
    // Solo se tocan las de otro cuento: las propias recién subidas nunca se quitan acá.
    const gone = reusedIds.filter((id) => !reused.some((doc) => doc.id === id));
    if (gone.length > 0) {
      await book.ref.update({ photoIds: FieldValue.arrayRemove(...gone), updatedAt: new Date() });
    }
    const photos = await Promise.all(
      [...snapshot.docs, ...reused].map((doc) => this.toPublic(doc.id, doc.data() as Photo)),
    );
    return photos.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Borrado inmediato y definitivo (el bucket no tiene papelera). */
  async delete(uid: string, photoId: string): Promise<void> {
    const { ref, data: photo } = await this.ownedPhoto(uid, photoId);
    const storage = this.providers.storage();
    await storage.delete({ bucket: 'photos', path: photo.storagePath });
    if (photo.processedPath) await storage.delete({ bucket: 'photos', path: photo.processedPath });
    const batch = this.db.batch();
    batch.delete(ref);
    if (photo.bookId) {
      batch.update(this.db.collection(COLLECTIONS.books).doc(photo.bookId), {
        photoIds: FieldValue.arrayRemove(photoId),
        updatedAt: new Date(),
      });
    }
    await batch.commit();
  }
}
