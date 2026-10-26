import { createHash } from 'node:crypto';

import { encodeIllustration, watermarkPreview, type ProviderRegistry } from '@storynido/providers';
import {
  COLLECTIONS,
  PREVIEW_ILLUSTRATED_PAGES,
  ProviderError,
  buildIllustrationPrompt,
  buildStoryPrompt,
  describeCharacterSheet,
  utcDay,
  type AIProvider,
  type BookPage,
  type BookPreview,
  type CharacterSheet,
  type GeneratedImage,
  type ImageData,
  type LessonPrompt,
  type Locale,
  type PublicPreview,
} from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';
import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';

import { AiBudget, type AiLimits, type UsageContext } from '../ai/budget';
import type { CatalogRepository } from '../catalog';
import { AppError } from '../errors';

const IMAGE_URL_SECONDS = 30 * 60;
/** Una generación "colgada" (instancia reiniciada a mitad de camino) se puede reintentar. */
const STALE_GENERATION_MS = 10 * 60 * 1000;
/** Vistas previas por IP y día: varias personas pueden compartir una IP (casa, oficina). */
const IP_QUOTA_MULTIPLIER = 3;

const notFound = () => new AppError(404, 'not_found', 'No encontramos ese borrador.');
const generationFailed = () =>
  new AppError(
    503,
    'ai_unavailable',
    'No pudimos generar la vista previa. Intenta de nuevo en unos minutos; tu borrador queda guardado.',
  );

type Target = 'cover' | number;

interface BookData {
  ownerUid: string;
  status: string;
  childId: string | null;
  storyId: string | null;
  styleId: string | null;
  lessonIds: string[];
  customLesson: string | null;
  language: Locale;
  photoIds: string[];
  preview: (Omit<BookPreview, 'generatedAt'> & { generatedAt: unknown }) | null;
  regenerationsUsed: number;
  previewError?: string | null;
  previewStartedAt?: unknown;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate();
  }
  return null;
}

/** Resultado moderado con un reintento automático si la moderación lo rechaza. */
async function withModeratedRetry<T>(
  produce: () => Promise<T>,
  check: (value: T) => Promise<boolean>,
): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const value = await produce();
    if (await check(value)) return value;
  }
  throw new AppError(
    422,
    'ai_unavailable',
    'El contenido generado no pasó nuestro control de calidad. Prueba con otra historia o estilo.',
  );
}

/**
 * Vista previa gratis: escribe el cuento completo, ilustra la portada y las primeras
 * páginas con la foto y la ficha del personaje, modera todo y guarda dos versiones de cada
 * imagen (limpia, para el libro comprado; con marca de agua, la única que ve el cliente).
 */
export class PreviewService {
  private readonly budget: AiBudget;

  constructor(
    private readonly db: Firestore,
    private readonly providers: ProviderRegistry,
    private readonly catalog: CatalogRepository,
    private readonly log: FastifyBaseLogger,
  ) {
    this.budget = new AiBudget(db, log);
  }

  private bookRef(bookId: string) {
    return this.db.collection(COLLECTIONS.books).doc(bookId);
  }

  private async ownedBook(uid: string, bookId: string) {
    const ref = this.bookRef(bookId);
    const book = (await ref.get()).data() as BookData | undefined;
    if (book?.ownerUid !== uid) throw notFound();
    return { ref, book };
  }

  // ---------------------------------------------------------------- lectura

  async get(uid: string, bookId: string): Promise<PublicPreview> {
    const { book } = await this.ownedBook(uid, bookId);
    return this.toPublic(bookId, book, await this.budget.limits());
  }

  private async toPublic(bookId: string, book: BookData, limits: AiLimits): Promise<PublicPreview> {
    const regenerationsLeft = Math.max(0, limits.maxRegenerationsPerBook - book.regenerationsUsed);
    const base = {
      bookId,
      status: book.status as PublicPreview['status'],
      error: book.previewError ?? null,
      regenerationsLeft,
    };
    const preview = book.preview;
    if (!preview) return { ...base, preview: null };

    const storage = this.providers.storage();
    const url = async (path: string) =>
      (await storage.signedDownloadUrl({ bucket: 'assets', path }, IMAGE_URL_SECONDS)).url;
    const visible = preview.pages.slice(0, PREVIEW_ILLUSTRATED_PAGES);
    return {
      ...base,
      preview: {
        title: preview.title,
        coverUrl: await url(preview.cover.previewImagePath),
        pages: await Promise.all(
          visible.map(async (page) => ({
            index: page.index,
            text: page.text,
            imageUrl: page.previewImagePath ? await url(page.previewImagePath) : null,
          })),
        ),
        totalPages: preview.pages.length,
        stale:
          preview.storyId !== book.storyId ||
          preview.styleId !== book.styleId ||
          preview.photoId !== book.photoIds[0],
        generatedAt: (toDate(preview.generatedAt) ?? new Date()).toISOString(),
      },
    };
  }

  // ---------------------------------------------------------- generación

  /** Reserva el turno: cuotas del día y estado "generando" en una sola transacción. */
  private async reserve(uid: string, ip: string, ref: DocumentReference, limits: AiLimits) {
    const day = utcDay();
    const quotas = this.db.collection(COLLECTIONS.previewQuota);
    const userQuota = quotas.doc(`${uid}_${day}`);
    // La IP se guarda con un hash corto: alcanza para limitar sin conservar la dirección.
    const ipQuota = quotas.doc(`ip_${hashIp(ip)}_${day}`);

    await this.db.runTransaction(async (tx) => {
      const [bookSnap, userSnap, ipSnap] = await Promise.all([
        tx.get(ref),
        tx.get(userQuota),
        tx.get(ipQuota),
      ]);
      const book = bookSnap.data() as BookData | undefined;
      if (book?.ownerUid !== uid) throw notFound();

      const startedAt = toDate(book.previewStartedAt);
      const stuck =
        book.status === 'preview_generating' &&
        (!startedAt || Date.now() - startedAt.getTime() > STALE_GENERATION_MS);
      if (book.status === 'preview_generating' && !stuck) {
        throw new AppError(409, 'bad_request', 'Ya estamos generando esta vista previa.');
      }
      if (!['draft', 'preview_ready', 'preview_generating'].includes(book.status)) {
        throw new AppError(409, 'bad_request', 'Este libro ya no se puede modificar.');
      }
      if (!book.childId || !book.storyId || !book.styleId) {
        throw new AppError(
          409,
          'bad_request',
          'Completa el protagonista, la historia y el estilo.',
        );
      }
      if (book.photoIds.length === 0) {
        throw new AppError(409, 'bad_request', 'Sube una foto del protagonista.');
      }

      const usedByUser = Number(userSnap.get('count') ?? 0);
      const usedByIp = Number(ipSnap.get('count') ?? 0);
      if (
        usedByUser >= limits.maxPreviewsPerUserPerDay ||
        usedByIp >= limits.maxPreviewsPerUserPerDay * IP_QUOTA_MULTIPLIER
      ) {
        throw new AppError(
          429,
          'limit_reached',
          'Llegaste al máximo de vistas previas por hoy. Podrás crear otra mañana.',
        );
      }

      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      tx.set(userQuota, { count: usedByUser + 1, expiresAt }, { merge: true });
      tx.set(ipQuota, { count: usedByIp + 1, expiresAt }, { merge: true });
      tx.update(ref, {
        status: 'preview_generating',
        previewStartedAt: new Date(),
        previewError: null,
        updatedAt: new Date(),
      });
    });
  }

  async generate(uid: string, bookId: string, ip: string): Promise<PublicPreview> {
    const limits = await this.budget.limits();
    await this.budget.ensureAvailable(limits);
    const ref = this.bookRef(bookId);
    await this.reserve(uid, ip, ref, limits);

    const { book } = await this.ownedBook(uid, bookId);
    try {
      const preview = await this.buildPreview(uid, bookId, book, limits);
      await ref.update({
        status: 'preview_ready',
        preview,
        previewStartedAt: null,
        previewError: null,
        updatedAt: new Date(),
      });
      this.log.info({ bookId }, 'preview ready');
    } catch (error) {
      const appError = error instanceof AppError ? error : generationFailed();
      this.log.error({ err: error, bookId }, 'preview failed');
      await ref.update({
        // Si había una vista previa anterior, sigue disponible.
        status: book.preview ? 'preview_ready' : 'draft',
        previewStartedAt: null,
        previewError: appError.message,
        updatedAt: new Date(),
      });
      throw appError;
    }
    return this.get(uid, bookId);
  }

  private async buildPreview(
    uid: string,
    bookId: string,
    book: BookData,
    limits: AiLimits,
  ): Promise<BookPreview> {
    const ai = this.providers.ai();
    const context = (kind: UsageContext['kind']): UsageContext => ({
      kind,
      ownerUid: uid,
      bookId,
    });
    const track = async <T extends { usage?: GeneratedImage['usage'] }>(
      kind: UsageContext['kind'],
      result: T,
    ): Promise<T> => {
      if (result.usage) await this.budget.record(result.usage, context(kind), limits);
      return result;
    };

    const [stories, styles, lessons, childSnap] = await Promise.all([
      this.catalog.stories(),
      this.catalog.styles(),
      this.catalog.lessons(),
      this.db
        .collection(COLLECTIONS.children)
        .doc(book.childId ?? '-')
        .get(),
    ]);
    const story = stories.find((item) => item.slug === book.storyId);
    const style = styles.find((item) => item.slug === book.styleId);
    const child = childSnap.data();
    if (!story || !style || child?.ownerUid !== uid) {
      throw new AppError(
        409,
        'bad_request',
        'La historia o el estilo elegidos ya no están disponibles.',
      );
    }

    // Enseñanzas en orden; el mensaje propio del adulto se modera antes de usarlo.
    const lessonPrompts: LessonPrompt[] = book.lessonIds.flatMap((id) => {
      const lesson = lessons.find((item) => item.slug === id);
      return lesson ? [{ name: lesson.name[book.language], guidance: lesson.promptGuidance }] : [];
    });
    if (book.customLesson) {
      const verdict = await track('moderation', await ai.text.moderateText(book.customLesson));
      if (!verdict.allowed) {
        throw new AppError(
          422,
          'validation_failed',
          'El mensaje propio no se puede usar en un cuento infantil. Edítalo e intenta de nuevo.',
        );
      }
      lessonPrompts.push({
        name: 'Mensaje de la familia',
        guidance: `Integra con naturalidad este mensaje: "${book.customLesson}"`,
      });
    }

    const photoId = book.photoIds[0] ?? '';
    const { photo, sheet } = await this.characterFor(uid, photoId, ai, track);
    const characterDescription = `${String(child.name)}: ${describeCharacterSheet(sheet)}`;

    const request = {
      language: book.language,
      childName: String(child.name),
      age: Number(child.age),
      pronouns: (child.pronouns ?? null) as 'she' | 'he' | 'they' | null,
      likes: (child.likes ?? []) as string[],
      petName: (child.petName ?? null) as string | null,
      bestFriendName: (child.bestFriendName ?? null) as string | null,
      dedication: null,
      storyTitle: story.title[book.language],
      lessons: lessonPrompts,
      pageCount: story.pageCount,
    };
    const prompt = buildStoryPrompt({ ...request, template: story.textPromptTemplate });

    // Texto: cuento, revisión editorial y moderación (un reintento si no pasa).
    const pages = await withModeratedRetry(
      async () => {
        const draft = await track('story', await ai.text.generateStory({ ...request, prompt }));
        const review = await track(
          'review',
          await ai.text.reviewStory(draft, { ...request, prompt }),
        );
        return { title: draft.title, pages: review.pages, approved: review.approved };
      },
      async (result) => {
        if (!result.approved) return false;
        const verdict = await track(
          'moderation',
          await ai.text.moderateText(
            [result.title, ...result.pages.map((page) => page.text)].join('\n\n'),
          ),
        );
        return verdict.allowed;
      },
    );

    const illustrate = (scene: string, references: ImageData[], seed: number) =>
      this.illustration(ai, track, limits, {
        prompt: buildIllustrationPrompt({
          template: story.imagePromptTemplate,
          scene,
          character: characterDescription,
          style: style.promptModifier,
        }),
        stylePrompt: style.promptModifier,
        character: { description: characterDescription, photo },
        references,
        aspectRatio: '3:4',
        seed,
      });

    const firstScene = pages.pages[0]?.illustrationPrompt ?? story.title.en;
    const cover = await illustrate(
      `Book cover illustration for "${pages.title}": the main character as the hero of the story, joyful and centered, leaving clear space at the top for the title. ${firstScene}`,
      [],
      1,
    );
    const illustrated = await Promise.all(
      pages.pages
        .slice(0, PREVIEW_ILLUSTRATED_PAGES)
        .map((page) => illustrate(page.illustrationPrompt, [cover.image], page.index + 2)),
    );

    const folder = `previews/${uid}/${bookId}`;
    const version = Date.now().toString(36);
    const coverPaths = await this.store(`${folder}/cover-${version}`, cover.image);
    const bookPages: BookPage[] = await Promise.all(
      pages.pages.map(async (page, index) => {
        const image = illustrated[index];
        const paths = image
          ? await this.store(`${folder}/page-${String(index)}-${version}`, image.image)
          : null;
        return {
          index: page.index,
          text: page.text,
          illustrationPrompt: page.illustrationPrompt,
          imagePath: paths?.clean ?? null,
          previewImagePath: paths?.preview ?? null,
        };
      }),
    );

    return {
      title: pages.title,
      cover: { imagePath: coverPaths.clean, previewImagePath: coverPaths.preview },
      pages: bookPages,
      storyId: story.slug,
      styleId: style.slug,
      photoId,
      generatedAt: new Date(),
    };
  }

  /** Foto procesada del protagonista y su ficha (se calcula una vez y se guarda en la foto). */
  private async characterFor(
    uid: string,
    photoId: string,
    ai: AIProvider,
    track: <T extends { usage?: GeneratedImage['usage'] }>(
      kind: UsageContext['kind'],
      result: T,
    ) => Promise<T>,
  ): Promise<{ photo: ImageData; sheet: CharacterSheet }> {
    const ref = this.db.collection(COLLECTIONS.photos).doc(photoId);
    const data = (await ref.get()).data();
    if (
      data?.ownerUid !== uid ||
      data.status !== 'valid' ||
      typeof data.processedPath !== 'string'
    ) {
      throw new AppError(
        409,
        'bad_request',
        'La foto del protagonista ya no está disponible. Sube otra.',
      );
    }
    const photo: ImageData = {
      bytes: await this.providers
        .storage()
        .download({ bucket: 'photos', path: data.processedPath }),
      mimeType: 'image/jpeg',
    };
    const saved = data.characterSheet as CharacterSheet | null | undefined;
    if (saved) return { photo, sheet: saved };
    const { sheet } = await track('character', await ai.text.describeCharacter(photo));
    await ref.update({ characterSheet: sheet, updatedAt: new Date() });
    return { photo, sheet };
  }

  private async illustration(
    ai: AIProvider,
    track: <T extends { usage?: GeneratedImage['usage'] }>(
      kind: UsageContext['kind'],
      result: T,
    ) => Promise<T>,
    limits: AiLimits,
    request: Parameters<AIProvider['image']['generateIllustration']>[0],
  ): Promise<{ image: ImageData }> {
    return withModeratedRetry(
      async () => {
        // Cada imagen es la parte cara: se verifica el tope antes de pedirla.
        await this.budget.ensureAvailable(limits);
        try {
          const generated = await track(
            'illustration',
            await ai.image.generateIllustration(request),
          );
          return { image: { bytes: generated.bytes, mimeType: generated.mimeType } };
        } catch (error) {
          if (error instanceof ProviderError) throw generationFailed();
          throw error;
        }
      },
      async ({ image }) => (await track('moderation', await ai.image.moderateImage(image))).allowed,
    );
  }

  /** Guarda la versión limpia y la que tiene marca de agua. */
  private async store(base: string, image: ImageData): Promise<{ clean: string; preview: string }> {
    const storage = this.providers.storage();
    const clean = `${base}.webp`;
    const preview = `${base}-preview.webp`;
    const [cleanBytes, previewBytes] = await Promise.all([
      encodeIllustration(image.bytes),
      watermarkPreview(image.bytes),
    ]);
    await Promise.all([
      storage.upload({ bucket: 'assets', path: clean }, cleanBytes, 'image/webp'),
      storage.upload({ bucket: 'assets', path: preview }, previewBytes, 'image/webp'),
    ]);
    return { clean, preview };
  }

  // ------------------------------------------------------------- edición

  private async readyBook(uid: string, bookId: string) {
    const { ref, book } = await this.ownedBook(uid, bookId);
    if (book.status !== 'preview_ready' || !book.preview) {
      throw new AppError(409, 'bad_request', 'Primero genera la vista previa.');
    }
    return { ref, book, preview: book.preview };
  }

  async updatePageText(uid: string, bookId: string, index: number, text: string) {
    const { ref, preview } = await this.readyBook(uid, bookId);
    if (!preview.pages[index]) throw notFound();
    const limits = await this.budget.limits();
    const verdict = await this.providers.ai().text.moderateText(text);
    if (verdict.usage) {
      await this.budget.record(
        verdict.usage,
        { kind: 'moderation', ownerUid: uid, bookId },
        limits,
      );
    }
    if (!verdict.allowed) {
      throw new AppError(
        422,
        'validation_failed',
        'Ese texto no es apto para un cuento infantil. Cámbialo e intenta de nuevo.',
      );
    }
    const pages = preview.pages.map((page) => (page.index === index ? { ...page, text } : page));
    await ref.update({ 'preview.pages': pages, updatedAt: new Date() });
    return this.get(uid, bookId);
  }

  async regenerate(uid: string, bookId: string, target: Target, ip: string) {
    const limits = await this.budget.limits();
    await this.budget.ensureAvailable(limits);
    const { ref, book, preview } = await this.readyBook(uid, bookId);
    if (target !== 'cover' && !(target < PREVIEW_ILLUSTRATED_PAGES && preview.pages[target])) {
      throw notFound();
    }

    // Reserva la regeneración antes de gastar (evita carreras con dos clics).
    await this.db.runTransaction(async (tx) => {
      const used = Number((await tx.get(ref)).get('regenerationsUsed') ?? 0);
      if (used >= limits.maxRegenerationsPerBook) {
        throw new AppError(
          429,
          'limit_reached',
          'Ya usaste las regeneraciones gratis de esta vista previa.',
        );
      }
      tx.update(ref, { regenerationsUsed: FieldValue.increment(1) });
    });

    try {
      const [stories, styles, childSnap] = await Promise.all([
        this.catalog.stories(),
        this.catalog.styles(),
        this.db
          .collection(COLLECTIONS.children)
          .doc(book.childId ?? '-')
          .get(),
      ]);
      const story = stories.find((item) => item.slug === preview.storyId);
      const style = styles.find((item) => item.slug === preview.styleId);
      if (!story || !style) throw generationFailed();
      const ai = this.providers.ai();
      const track = async <T extends { usage?: GeneratedImage['usage'] }>(
        kind: UsageContext['kind'],
        result: T,
      ): Promise<T> => {
        if (result.usage) {
          await this.budget.record(result.usage, { kind, ownerUid: uid, bookId }, limits);
        }
        return result;
      };
      const { photo, sheet } = await this.characterFor(uid, preview.photoId, ai, track);
      const description = `${String(childSnap.get('name'))}: ${describeCharacterSheet(sheet)}`;
      const storage = this.providers.storage();
      const coverImage: ImageData = {
        bytes: await storage.download({ bucket: 'assets', path: preview.cover.imagePath }),
        mimeType: 'image/webp',
      };
      const scene =
        target === 'cover'
          ? `Book cover illustration for "${preview.title}": the main character as the hero of the story, joyful and centered, leaving clear space at the top for the title. ${preview.pages[0]?.illustrationPrompt ?? ''}`
          : (preview.pages[target]?.illustrationPrompt ?? '');
      const { image } = await this.illustration(ai, track, limits, {
        prompt: buildIllustrationPrompt({
          template: story.imagePromptTemplate,
          scene,
          character: description,
          style: style.promptModifier,
        }),
        stylePrompt: style.promptModifier,
        character: { description, photo },
        references: target === 'cover' ? [] : [coverImage],
        aspectRatio: '3:4',
        seed: Date.now() % 100_000,
      });

      const version = Date.now().toString(36);
      const folder = `previews/${uid}/${bookId}`;
      const old =
        target === 'cover'
          ? preview.cover
          : {
              imagePath: preview.pages[target]?.imagePath,
              previewImagePath: preview.pages[target]?.previewImagePath,
            };
      const paths = await this.store(
        `${folder}/${target === 'cover' ? 'cover' : `page-${String(target)}`}-${version}`,
        image,
      );
      if (target === 'cover') {
        await ref.update({
          'preview.cover': { imagePath: paths.clean, previewImagePath: paths.preview },
          updatedAt: new Date(),
        });
      } else {
        const pages = preview.pages.map((page) =>
          page.index === target
            ? { ...page, imagePath: paths.clean, previewImagePath: paths.preview }
            : page,
        );
        await ref.update({ 'preview.pages': pages, updatedAt: new Date() });
      }
      // La versión anterior ya no se usa.
      await Promise.all(
        [old.imagePath, old.previewImagePath]
          .filter((path): path is string => typeof path === 'string')
          .map((path) => storage.delete({ bucket: 'assets', path })),
      );
      this.log.info({ bookId, target, ipHash: hashIp(ip) }, 'preview illustration regenerated');
    } catch (error) {
      // Si falló, la regeneración no se cuenta.
      await ref.update({ regenerationsUsed: FieldValue.increment(-1) });
      throw error instanceof AppError ? error : generationFailed();
    }
    return this.get(uid, bookId);
  }
}

/** Hash corto de la IP con el día: limita sin guardar ni registrar la dirección. */
function hashIp(ip: string): string {
  return createHash('sha256').update(`${utcDay()}|${ip}`).digest('hex').slice(0, 16);
}
