import {
  COLLECTIONS,
  SHOWCASE_FILE_PATTERN,
  SHOWCASE_MIN_BOOKS,
  apiRoutes,
  normalizeFirestoreData,
  showcaseFilePath,
  type AdminShowcaseBook,
  type Locale,
  type PublicShowcaseBook,
  type ShowcaseBook,
  type ShowcaseStatus,
} from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { actorLabel, auditedWrite } from '../admin/audit';
import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);

/** El documento como lo guardó el script del golden set, con las fechas normalizadas. */
const read = (doc: DocumentSnapshot) => normalizeFirestoreData(doc.data() ?? {}) as ShowcaseBook;

const imagePath = (id: string, file: string) => `/v1/catalog/showcase/${id}/${file}`;

export function toPublicShowcase(id: string, book: ShowcaseBook): PublicShowcaseBook {
  return {
    id,
    storySlug: book.storySlug,
    channel: book.channel,
    title: book.title,
    childName: book.childName,
    age: book.age,
    styleSlug: book.styleSlug,
    cover: imagePath(id, book.cover),
    pages: book.pages.map((page) => ({ image: imagePath(id, page.file), text: page.text })),
  };
}

/** Aprobados de un idioma, en el orden en que se aprobaron. */
async function approved(app: FastifyInstance, locale?: Locale) {
  const snapshot = await app.deps.db
    .collection(COLLECTIONS.showcaseBooks)
    .where('status', '==', 'approved')
    .get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, book: read(doc) }))
    .filter((item) => item.book.eligible && (!locale || item.book.locale === locale))
    .sort((a, b) => (a.book.reviewedAt?.getTime() ?? 0) - (b.book.reviewedAt?.getTime() ?? 0));
}

/**
 * Libros de ejemplo aprobados por la mesa (DECISIONS 348). La web los muestra tal cual salieron;
 * la sección queda cerrada hasta tener SHOWCASE_MIN_BOOKS aprobados en el idioma.
 */
export function registerShowcaseRoutes(app: FastifyInstance): void {
  const { db, providers } = app.deps;

  addRoute(app, apiRoutes.catalogShowcase, {}, async (request) => {
    const { locale } = request.query as { locale: Locale };
    const books = await approved(app, locale);
    const open = books.length >= SHOWCASE_MIN_BOOKS;
    return {
      open,
      books: open ? books.map(({ id, book }) => toPublicShowcase(id, book)) : [],
    };
  });

  // Las imágenes pasan por la API: el bucket es privado y así un libro retirado deja de verse.
  app.get<{ Params: { id: string; file: string } }>(
    '/v1/catalog/showcase/:id/:file',
    { schema: { hide: true }, config: { availability: 'normal' } },
    async (request, reply) => {
      const { id, file } = request.params;
      if (!SHOWCASE_FILE_PATTERN.test(file) || id.length > 120 || id.includes('/')) {
        throw new AppError(404, 'not_found', 'La imagen no existe.');
      }
      const doc = await db.collection(COLLECTIONS.showcaseBooks).doc(id).get();
      const book = doc.exists ? read(doc) : null;
      const listed =
        book?.status === 'approved' &&
        book.eligible &&
        (book.cover === file || book.pages.some((page) => page.file === file));
      if (!listed) throw new AppError(404, 'not_found', 'La imagen no existe.');
      const bytes = await providers
        .storage()
        .download({ bucket: 'assets', path: showcaseFilePath(id, file) });
      return reply
        .type('image/webp')
        .header('cache-control', 'public, max-age=3600')
        .send(Buffer.from(bytes));
    },
  );

  async function toAdmin(id: string, book: ShowcaseBook): Promise<AdminShowcaseBook> {
    const storage = providers.storage();
    const url = (file: string) =>
      storage
        .signedDownloadUrl({ bucket: 'assets', path: showcaseFilePath(id, file) }, 900)
        .then((link) => link.url)
        .catch(() => null);
    return {
      id,
      storySlug: book.storySlug,
      channel: book.channel,
      locale: book.locale,
      title: book.title,
      childName: book.childName,
      age: book.age,
      styleSlug: book.styleSlug,
      cover: await url(book.cover),
      pages: await Promise.all(
        book.pages.map(async (page) => ({ image: await url(page.file), text: page.text })),
      ),
      panel: book.panel,
      source: book.source,
      eligible: book.eligible,
      reasons: book.reasons,
      status: book.status,
      reviewedBy: book.reviewedBy,
      reviewedAt: iso(book.reviewedAt),
      createdAt: iso(book.createdAt),
    };
  }

  addRoute(app, apiRoutes.adminShowcase, {}, async () => {
    const snapshot = await db
      .collection(COLLECTIONS.showcaseBooks)
      .orderBy('createdAt', 'desc')
      .limit(60)
      .get();
    const approvedByLocale: Record<string, number> = {};
    for (const { book } of await approved(app)) {
      approvedByLocale[book.locale] = (approvedByLocale[book.locale] ?? 0) + 1;
    }
    return {
      minBooks: SHOWCASE_MIN_BOOKS,
      approvedByLocale,
      books: await Promise.all(snapshot.docs.map((doc) => toAdmin(doc.id, read(doc)))),
    };
  });

  addRoute(app, apiRoutes.adminSetShowcaseStatus, {}, async (request) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: ShowcaseStatus };
    const ref = db.collection(COLLECTIONS.showcaseBooks).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError(404, 'not_found', 'Ese libro de ejemplo no existe.');
    const book = read(doc);
    if (status === 'approved' && !book.eligible) {
      throw new AppError(
        400,
        'bad_request',
        `Este libro no califica para mostrarse: ${book.reasons.join('; ')}.`,
      );
    }
    const reviewedAt = new Date();
    const reviewedBy = actorLabel(request.user ?? null);
    await auditedWrite(
      db,
      request.user ?? null,
      {
        action: 'showcase.status',
        entity: 'showcaseBook',
        entityId: id,
        before: { status: book.status },
        after: { status },
      },
      (batch) => {
        batch.update(ref, { status, reviewedAt, reviewedBy });
      },
    );
    return toAdmin(id, { ...book, status, reviewedAt, reviewedBy });
  });
}
