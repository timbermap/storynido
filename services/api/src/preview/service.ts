import { createHash } from 'node:crypto';

import { encodeIllustration, watermarkPreview, type ProviderRegistry } from '@storynido/providers';
import {
  COLLECTIONS,
  CHARACTER_REFERENCE_SCENE,
  editorialPlan,
  nameIssues,
  traitsKey,
  type CharacterTraits,
  type MustKeepTrait,
  type QaEvent,
  pagesOutOfRange,
  type BookEvent,
  type BookLength,
  type ContentType,
  type ReadingLevel,
  type TextDensity,
  avatarKey,
  avatarToSheet,
  hasMemories,
  type Avatar,
  type Memories,
  PREVIEW_ILLUSTRATED_PAGES,
  ProviderError,
  artDirection,
  buildIllustrationPrompt,
  companionNote,
  companionReferenceScene,
  coverScene,
  describeCharacter,
  buildStoryPrompt,
  utcDay,
  type AIProvider,
  type BookPreview,
  type Channel,
  type CharacterSheet,
  type GeneratedImage,
  type ImageData,
  type LessonPrompt,
  type Locale,
  type PublicPreview,
  storyGoalOptions,
  validGoal,
  acceptsChildPhotos,
  aiModelSchema,
  type PreviewFeedbackReason,
} from '@storynido/shared';
import type { EmailNotifier } from '@storynido/emails';
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
  /** Los borradores anteriores al modo sin foto no tienen estos campos. */
  characterMode?: 'photo' | 'avatar';
  avatar?: Avatar | null;
  memories?: Memories | null;
  /** Eventos (fase 12b). */
  event?: BookEvent | null;
  /** Profesionales (fase 12c): objetivo general de la colección. */
  goal?: string | null;
  dedication?: string | null;
  /** Rasgos confirmados por el adulto (fase 07d). */
  characterTraits?: CharacterTraits | null;
  mustKeep?: MustKeepTrait[];
  /** Foto o rasgos elegidos sobre los que se confirmaron (si cambian, los rasgos no valen). */
  characterBase?: string | null;
  /** Opciones editoriales (fase 07b); los libros anteriores no las tienen. */
  length?: BookLength | null;
  textDensity?: TextDensity;
  readingLevel?: ReadingLevel;
  contentType?: ContentType;
  /** Línea comercial (los libros anteriores son de Familias). */
  channel?: Channel;
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
    private readonly notifier: EmailNotifier | null = null,
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

  /**
   * Borra un borrador del usuario: el libro, sus eventos de calidad y las imágenes de la muestra
   * (no se espera a la limpieza de 30 días: son ilustraciones del niño). Lo pedido no se borra.
   */
  async deleteDraft(uid: string, bookId: string): Promise<{ deleted: true }> {
    const { ref, book } = await this.ownedBook(uid, bookId);
    if (book.status === 'preview_generating') {
      throw new AppError(
        409,
        'bad_request',
        'La muestra se está creando. Espera a que termine para borrarla.',
      );
    }
    // Un pago iniciado también bloquea: el cobro todavía puede confirmarse.
    const orders = await this.db.collection(COLLECTIONS.orders).where('bookId', '==', bookId).get();
    const active = orders.docs.some((order) => order.get('status') !== 'cancelled');
    if (book.status === 'ordered' || active) {
      throw new AppError(
        409,
        'bad_request',
        'Este cuento ya tiene un pedido y no se puede borrar.',
      );
    }
    const preview = book.preview;
    const paths = new Set(
      [
        preview?.character?.imagePath,
        preview?.character?.previewImagePath,
        preview?.characterImagePath,
        preview?.companion?.imagePath,
        preview?.cover?.imagePath,
        preview?.cover?.previewImagePath,
        ...(preview?.pages ?? []).flatMap((page) => [page.imagePath, page.previewImagePath]),
      ].filter((path): path is string => typeof path === 'string' && path.length > 0),
    );
    const storage = this.providers.storage();
    await Promise.all([...paths].map((path) => storage.delete({ bucket: 'assets', path })));
    await this.db.recursiveDelete(ref);
    this.log.info({ bookId, images: paths.size }, 'draft deleted');
    return { deleted: true };
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
    const stage = preview.stage ?? 'complete';
    return {
      ...base,
      preview: {
        stage,
        title: preview.title,
        coverUrl: preview.cover ? await url(preview.cover.previewImagePath) : null,
        character: preview.character
          ? {
              imageUrl: await url(preview.character.previewImagePath),
              traits: preview.character.traits,
              mustKeep: preview.character.mustKeep,
              approved: preview.character.approvedAt !== null,
            }
          : null,
        dedication: book.dedication ?? null,
        // Todas las páginas: el visor muestra el libro entero (las no ilustradas, con su texto).
        pages: await Promise.all(
          preview.pages.map(async (page) => ({
            index: page.index,
            text: page.text,
            imageUrl: page.previewImagePath ? await url(page.previewImagePath) : null,
          })),
        ),
        totalPages: preview.interiorPages ?? preview.pages.length,
        stale: isStale(preview, book),
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
    // Catálogo de modelos: si el modelo de imagen activo no puede recibir fotos de chicos
    // (entrena con los datos, tiene revisión humana o no está permitido), solo modo sin foto.
    const imageModel = (
      await this.db.collection(COLLECTIONS.aiModels).doc(this.providers.aiModels().image).get()
    ).data();
    const entry = imageModel ? aiModelSchema.safeParse(imageModel) : null;
    const photosAllowed = !entry?.success || acceptsChildPhotos(entry.data);

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
      if (book.characterMode !== 'avatar' && !photosAllowed) {
        throw new AppError(
          409,
          'bad_request',
          'Por ahora las muestras se crean sin foto: elige los rasgos del protagonista.',
        );
      }
      if (book.characterMode === 'avatar' ? !book.avatar : book.photoIds.length === 0) {
        throw new AppError(
          409,
          'bad_request',
          book.characterMode === 'avatar'
            ? 'Elige los rasgos del protagonista.'
            : 'Sube una foto del protagonista.',
        );
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

  async generate(
    uid: string,
    bookId: string,
    ip: string,
    anonymous: boolean,
  ): Promise<PublicPreview> {
    // Crear pide cuenta en todas las líneas (DECISIONS 106): sin sesiones anónimas que gasten IA.
    if (anonymous) {
      throw new AppError(
        403,
        'account_required',
        'Inicia sesión para crear la vista previa. Así guardamos tu borrador y protegemos las fotos.',
      );
    }
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
    const choice = editorialChoice(book);
    // Para colorear siempre se usan contornos limpios, aunque el borrador tenga otro estilo.
    const style =
      choice.contentType === 'coloring'
        ? styles.find((item) => item.contentTypes.includes('coloring'))
        : styles.find((item) => item.slug === book.styleId);
    const plan = editorialPlan(choice, await this.catalog.editorial(), story?.pageCount ?? 12);
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

    // Recuerdos guiados: se moderan antes de entrar al prompt.
    const memories = hasMemories(book.memories) ? book.memories : null;
    if (memories) {
      const verdict = await track(
        'moderation',
        await ai.text.moderateText(Object.values(memories).filter(Boolean).join('\n')),
      );
      if (!verdict.allowed) {
        throw new AppError(
          422,
          'validation_failed',
          'Alguno de los recuerdos no se puede usar en un cuento infantil. Edítalo e intenta de nuevo.',
        );
      }
    }

    // Profesionales: el objetivo tiene que ser uno de los temas de las colecciones de la
    // historia (así no entra texto libre al prompt).
    const goal = book.goal
      ? validGoal(book.goal, storyGoalOptions(story, await this.catalog.collections()))
      : null;

    // Eventos: la temática de la fiesta también se modera antes de entrar al prompt.
    const event = book.event ?? null;
    if (event?.theme) {
      const verdict = await track('moderation', await ai.text.moderateText(event.theme));
      if (!verdict.allowed) {
        throw new AppError(
          422,
          'validation_failed',
          'La temática no se puede usar en un cuento infantil. Edítala e intenta de nuevo.',
        );
      }
    }

    const { photo, sheet, traits, mustKeep } = await this.characterOf(
      uid,
      book,
      Number(child.age),
      ai,
      track,
    );
    const characterDescription = describeCharacter(String(child.name), sheet, traits, mustKeep);
    // Nombres que tienen que aparecer tal cual: el del protagonista y el apodo de los recuerdos.
    const requiredNames = [String(child.name), memories?.nickname ?? ''].filter(Boolean);

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
      // Libro de actividades: la historia breve que les da contexto.
      pageCount: Math.max(plan.narrativePages, PREVIEW_ILLUSTRATED_PAGES),
      wordsPerPage: plan.words,
      mustInclude: requiredNames.slice(1),
    };
    const promptInput = {
      ...request,
      template: story.textPromptTemplate,
      memories,
      event,
      goal,
      levelGuidance: plan.levelGuidance,
      coloring: plan.contentType === 'coloring',
    };
    // Planificador editorial (guía A): arco, escenas y qué se ve en cada página. El redactor lo
    // sigue y el pipeline lo usa para ilustrar y revisar cada página.
    const { usage: planUsage, ...storyPlan } = await ai.text.planStory({
      ...request,
      prompt: buildStoryPrompt(promptInput),
    });
    await track('story', { usage: planUsage });
    const prompt = buildStoryPrompt({ ...promptInput, plan: storyPlan });

    // Texto: cuento, revisión editorial y moderación (un reintento si no pasa).
    const pages = await withModeratedRetry(
      async () => {
        const write = async () => {
          const draft = await track('story', await ai.text.generateStory({ ...request, prompt }));
          const review = await track(
            'review',
            await ai.text.reviewStory(draft, { ...request, prompt }),
          );
          return { title: draft.title, pages: review.pages, approved: review.approved };
        };
        // Densidad y nombres exactos: si algo no cumple, 1 reescritura.
        const problems = (draft: { title: string; pages: { text: string }[] }) => ({
          outOfRange: pagesOutOfRange(draft.pages, plan.words).length,
          names: nameIssues([draft.title, ...draft.pages.map((page) => page.text)], requiredNames)
            .length,
        });
        const first = await write();
        const found = problems(first);
        if (found.outOfRange === 0 && found.names === 0) return first;
        if (found.outOfRange > 0) {
          await this.qaEvent(bookId, 'length_out_of_range', { pages: found.outOfRange });
        }
        if (found.names > 0) await this.qaEvent(bookId, 'name_mismatch', { names: found.names });
        const second = await write();
        if (problems(second).names > 0) {
          throw new AppError(
            503,
            'ai_unavailable',
            'No logramos escribir el nombre del protagonista tal cual lo escribiste. Intenta de nuevo en unos minutos.',
          );
        }
        return second;
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

    // Dirección de arte (paleta, edad, encuadre, qué evitar): queda en la muestra y se congela
    // en el pedido, así el libro final se ilustra igual que lo aprobado.
    const direction = artDirection({
      age: Number(child.age),
      channel: book.channel ?? 'families',
      palette: story.palette,
      coloring: plan.contentType === 'coloring',
    });

    // Etapa 1: solo la lámina del personaje (1 imagen). La portada y las páginas se ilustran
    // cuando el adulto aprueba al personaje: si no se parece, no se gastan más imágenes.
    const character = await this.illustration(ai, track, limits, {
      prompt: buildIllustrationPrompt({
        template: story.imagePromptTemplate,
        scene: CHARACTER_REFERENCE_SCENE,
        character: characterDescription,
        style: style.promptModifier,
        direction,
      }),
      stylePrompt: style.promptModifier,
      character: { description: characterDescription, photo },
      references: [],
      aspectRatio: '3:4',
      seed: 0,
    });
    const characterPaths = await this.store(
      `previews/${uid}/${bookId}/character-${Date.now().toString(36)}`,
      character.image,
    );

    return {
      title: pages.title,
      stage: 'character',
      cover: null,
      character: {
        imagePath: characterPaths.clean,
        previewImagePath: characterPaths.preview,
        traits,
        mustKeep,
        approvedAt: null,
      },
      characterImagePath: characterPaths.clean,
      pages: pages.pages.map((page) => ({
        index: page.index,
        text: page.text,
        illustrationPrompt: page.illustrationPrompt,
        imagePath: null,
        previewImagePath: null,
      })),
      storyId: story.slug,
      styleId: style.slug,
      photoId: characterKey(book),
      editorialKey: editorialKey(book),
      interiorPages: plan.interiorPages,
      artDirection: direction,
      activityPages: plan.activityPages,
      words: plan.words,
      plan: storyPlan,
      generatedAt: new Date(),
    };
  }

  /** Ficha del personaje: de los rasgos elegidos (sin foto) o de la foto procesada. */
  private async characterOf(
    uid: string,
    book: BookData,
    age: number,
    ai: AIProvider,
    track: <T extends { usage?: GeneratedImage['usage'] }>(
      kind: UsageContext['kind'],
      result: T,
    ) => Promise<T>,
  ): Promise<{
    photo: ImageData | null;
    sheet: CharacterSheet;
    traits: CharacterTraits;
    mustKeep: MustKeepTrait[];
  }> {
    // Los rasgos que el adulto confirmó o corrigió tienen prioridad sobre los estimados.
    if (book.characterMode === 'avatar') {
      if (!book.avatar)
        throw new AppError(409, 'bad_request', 'Elige los rasgos del protagonista.');
      const traits = confirmedTraits(book)?.traits ?? { ...book.avatar, distinctive: null };
      return {
        photo: null,
        sheet: avatarToSheet(book.avatar, age),
        traits,
        mustKeep: confirmedTraits(book)?.mustKeep ?? defaultMustKeep(traits),
      };
    }
    const fromPhoto = await this.characterFor(uid, book.photoIds[0] ?? '', ai, track);
    const confirmed = confirmedTraits(book);
    const traits = confirmed?.traits ?? { ...fromPhoto.traits, distinctive: null };
    return { ...fromPhoto, traits, mustKeep: confirmed?.mustKeep ?? defaultMustKeep(traits) };
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
  ): Promise<{ photo: ImageData; sheet: CharacterSheet; traits: Avatar }> {
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
    const savedTraits = data.characterTraits as Avatar | null | undefined;
    if (saved && savedTraits) return { photo, sheet: saved, traits: savedTraits };
    const { sheet, traits } = await track('character', await ai.text.describeCharacter(photo));
    // Se guarda en la foto: se borra con ella.
    await ref.update({ characterSheet: sheet, characterTraits: traits, updatedAt: new Date() });
    return { photo, sheet, traits };
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

  /** Registro de control de calidad del libro (sin datos del niño). */
  /** "Tu muestra está lista" (una vez por libro), por si se fue de la página mientras tanto. */
  private async notifyPreviewReady(uid: string, bookId: string) {
    if (!this.notifier) return;
    const book = (await this.bookRef(bookId).get()).data() ?? {};
    const childId = typeof book.childId === 'string' ? book.childId : null;
    const child = childId
      ? (await this.db.collection(COLLECTIONS.children).doc(childId).get()).data()
      : undefined;
    const title = (book.preview as { title?: string } | null)?.title;
    const saved: unknown = book.language;
    const language = saved === 'en' || saved === 'pt' ? saved : 'es';
    if (!title || typeof child?.name !== 'string') return;
    await this.notifier.notify({
      key: `book:${bookId}:preview_ready`,
      template: 'preview_ready',
      uid,
      data: {
        childName: child.name,
        bookTitle: title,
        url: this.notifier.createUrl(language, bookId),
      },
    });
  }

  /**
   * "¿Qué mejorarías?" después de la muestra. Un evento por motivo y por libro (repetir la
   * respuesta no suma de nuevo): sale en el panel de Calidad junto a los demás códigos.
   */
  async feedback(uid: string, bookId: string, reasons: readonly PreviewFeedbackReason[]) {
    await this.ownedBook(uid, bookId);
    const events = this.bookRef(bookId).collection(COLLECTIONS.qaEvents);
    await Promise.all(
      [...new Set(reasons)].map((reason) => {
        const event: QaEvent = { code: `feedback_${reason}`, at: new Date(), detail: null };
        return events.doc(`feedback_${reason}`).set(event);
      }),
    );
    return { saved: true as const };
  }

  private async qaEvent(bookId: string, code: QaEvent['code'], detail: QaEvent['detail'] = null) {
    const event: QaEvent = { code, at: new Date(), detail };
    await this.bookRef(bookId).collection(COLLECTIONS.qaEvents).add(event);
  }

  // ------------------------------------------------- aprobación del personaje

  /** "Sí, es así": se ilustran la portada y las primeras páginas con la lámina aprobada. */
  async approveCharacter(uid: string, bookId: string, anonymous: boolean): Promise<PublicPreview> {
    const limits = await this.budget.limits();
    if (anonymous && limits.illustrationsRequireAccount) {
      throw new AppError(
        403,
        'account_required',
        'Crea tu cuenta gratis para ver la portada y las páginas ilustradas.',
      );
    }
    await this.budget.ensureAvailable(limits);
    const { ref, book, preview } = await this.readyBook(uid, bookId);
    if ((preview.stage ?? 'complete') !== 'character' || !preview.character) {
      throw new AppError(409, 'bad_request', 'El personaje ya está aprobado.');
    }
    // Aprobar confirma los rasgos para esta foto y estas elecciones: si cambiaron, primero se
    // crea la muestra de nuevo.
    if (isStale(preview, book)) {
      throw new AppError(409, 'bad_request', 'Cambiaste tus elecciones: crea la muestra de nuevo.');
    }
    // Bloqueo: mientras se ilustra, el libro queda "generando" (la web lo sigue en vivo).
    await this.db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as BookData | undefined;
      if (current?.status !== 'preview_ready') {
        throw new AppError(409, 'bad_request', 'Ya estamos ilustrando esta vista previa.');
      }
      tx.update(ref, { status: 'preview_generating', previewStartedAt: new Date() });
    });

    try {
      const { story, style, child } = await this.context(uid, book, preview);
      const ai = this.providers.ai();
      const track = this.tracker(uid, bookId, limits);
      const { photo, sheet } = await this.characterOf(uid, book, Number(child.age), ai, track);
      const { traits, mustKeep } = preview.character;
      const description = describeCharacter(String(child.name), sheet, traits, mustKeep);
      const storage = this.providers.storage();
      const lamina: ImageData = {
        bytes: await storage.download({ bucket: 'assets', path: preview.character.imagePath }),
        mimeType: 'image/webp',
      };
      // Acompañante que se repite (abuela, mascota): su lámina, una vez y con el mismo estilo,
      // es la segunda referencia de cada ilustración (DECISIONS 117).
      const companionPlan = preview.plan?.companion ?? null;
      const companion = companionPlan
        ? {
            ...companionPlan,
            image: (
              await this.illustration(ai, track, limits, {
                prompt: buildIllustrationPrompt({
                  template: story.imagePromptTemplate,
                  scene: companionReferenceScene(companionPlan),
                  character: companionPlan.look,
                  style: style.promptModifier,
                  direction: preview.artDirection,
                }),
                stylePrompt: style.promptModifier,
                character: { description: companionPlan.look, photo: null },
                references: [lamina],
                aspectRatio: '3:4',
                seed: 0,
              })
            ).image,
          }
        : null;
      const sceneCharacter = companion
        ? `${description}\n${companionNote(companion)}`
        : description;
      const illustrate = (scene: string, seed: number) =>
        this.illustration(ai, track, limits, {
          prompt: buildIllustrationPrompt({
            template: story.imagePromptTemplate,
            scene,
            character: sceneCharacter,
            style: style.promptModifier,
            direction: preview.artDirection,
          }),
          stylePrompt: style.promptModifier,
          character: { description, photo },
          references: companion ? [lamina, companion.image] : [lamina],
          aspectRatio: '3:4',
          // La portada y las páginas pueden ir a imprenta: 2K (~220 dpi a 21×28; DECISIONS 071).
          resolution: '2K',
          seed,
        });
      // Todas usan la lámina aprobada como referencia, así que se generan en paralelo.
      const [cover, ...illustrated] = await Promise.all([
        illustrate(coverScene(preview.pages[0]?.illustrationPrompt), 1),
        ...preview.pages
          .slice(0, PREVIEW_ILLUSTRATED_PAGES)
          .map((page) => illustrate(page.illustrationPrompt, page.index + 2)),
      ]);

      const folder = `previews/${uid}/${bookId}`;
      const version = Date.now().toString(36);
      const coverPaths = await this.store(`${folder}/cover-${version}`, cover.image);
      const companionPaths = companion
        ? await this.store(`${folder}/companion-${version}`, companion.image)
        : null;
      const pages = await Promise.all(
        preview.pages.map(async (page, index) => {
          const image = illustrated[index];
          if (!image) return page;
          const paths = await this.store(`${folder}/page-${String(index)}-${version}`, image.image);
          return { ...page, imagePath: paths.clean, previewImagePath: paths.preview };
        }),
      );
      await ref.update({
        status: 'preview_ready',
        previewStartedAt: null,
        'preview.stage': 'complete',
        'preview.cover': { imagePath: coverPaths.clean, previewImagePath: coverPaths.preview },
        'preview.pages': pages,
        'preview.character.approvedAt': new Date(),
        'preview.companion':
          companion && companionPaths
            ? { name: companion.name, look: companion.look, imagePath: companionPaths.clean }
            : null,
        // Los rasgos aprobados sobreviven a una nueva muestra (mientras no cambie la foto o los rasgos).
        'preview.photoId': characterKey({
          ...book,
          characterTraits: traits,
          mustKeep,
          characterBase: characterBase(book),
        }),
        characterTraits: traits,
        mustKeep,
        characterBase: characterBase(book),
        updatedAt: new Date(),
      });
      await this.qaEvent(bookId, 'character_approved', { mustKeep: mustKeep.length });
      if (!anonymous) await this.notifyPreviewReady(uid, bookId);
    } catch (error) {
      await ref.update({ status: 'preview_ready', previewStartedAt: null });
      throw error instanceof AppError ? error : generationFailed();
    }
    return this.get(uid, bookId);
  }

  /**
   * "Corregir rasgos": guarda los rasgos y los que no pueden cambiar, y vuelve a dibujar la
   * lámina (cuenta como regeneración). Las ilustraciones anteriores dejan de valer.
   */
  async updateCharacter(
    uid: string,
    bookId: string,
    traits: CharacterTraits,
    mustKeep: MustKeepTrait[],
  ): Promise<PublicPreview> {
    const limits = await this.budget.limits();
    await this.budget.ensureAvailable(limits);
    const { ref, book, preview } = await this.readyBook(uid, bookId);
    const ai = this.providers.ai();
    if (traits.distinctive) {
      const verdict = await ai.text.moderateText(traits.distinctive);
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
          'Ese rasgo no se puede usar. Cámbialo e intenta de nuevo.',
        );
      }
    }
    await this.reserveRegeneration(ref, limits);

    try {
      const { story, style, child } = await this.context(uid, book, preview);
      const track = this.tracker(uid, bookId, limits);
      const { photo, sheet } = await this.characterOf(uid, book, Number(child.age), ai, track);
      const description = describeCharacter(String(child.name), sheet, traits, mustKeep);
      const { image } = await this.illustration(ai, track, limits, {
        prompt: buildIllustrationPrompt({
          template: story.imagePromptTemplate,
          scene: CHARACTER_REFERENCE_SCENE,
          character: description,
          style: style.promptModifier,
          direction: preview.artDirection,
        }),
        stylePrompt: style.promptModifier,
        character: { description, photo },
        references: [],
        aspectRatio: '3:4',
        seed: Date.now() % 100_000,
      });
      const paths = await this.store(
        `previews/${uid}/${bookId}/character-${Date.now().toString(36)}`,
        image,
      );
      const storage = this.providers.storage();
      // Lo anterior (lámina e ilustraciones) ya no corresponde a este personaje.
      const stale = [
        preview.character?.imagePath,
        preview.character?.previewImagePath,
        preview.cover?.imagePath,
        preview.cover?.previewImagePath,
        ...preview.pages.flatMap((page) => [page.imagePath, page.previewImagePath]),
      ].filter((path): path is string => typeof path === 'string');
      const updatedBook = {
        ...book,
        characterTraits: traits,
        mustKeep,
        characterBase: characterBase(book),
      };
      await ref.update({
        'preview.stage': 'character',
        'preview.cover': null,
        'preview.character': {
          imagePath: paths.clean,
          previewImagePath: paths.preview,
          traits,
          mustKeep,
          approvedAt: null,
        },
        'preview.characterImagePath': paths.clean,
        'preview.pages': preview.pages.map((page) => ({
          ...page,
          imagePath: null,
          previewImagePath: null,
        })),
        'preview.photoId': characterKey(updatedBook),
        characterTraits: traits,
        mustKeep,
        characterBase: updatedBook.characterBase,
        updatedAt: new Date(),
      });
      await Promise.all(stale.map((path) => storage.delete({ bucket: 'assets', path })));
      await this.qaEvent(bookId, 'character_corrected', { mustKeep: mustKeep.length });
    } catch (error) {
      await ref.update({ regenerationsUsed: FieldValue.increment(-1) });
      throw error instanceof AppError ? error : generationFailed();
    }
    return this.get(uid, bookId);
  }

  /** Reserva una regeneración antes de gastar (evita carreras con dos clics). */
  private async reserveRegeneration(ref: DocumentReference, limits: AiLimits) {
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
  }

  private tracker(uid: string, bookId: string, limits: AiLimits) {
    return async <T extends { usage?: GeneratedImage['usage'] }>(
      kind: UsageContext['kind'],
      result: T,
    ): Promise<T> => {
      if (result.usage) {
        await this.budget.record(result.usage, { kind, ownerUid: uid, bookId }, limits);
      }
      return result;
    };
  }

  /** Historia, estilo y protagonista con los que se generó la muestra. */
  private async context(
    uid: string,
    book: BookData,
    preview: { storyId: string; styleId: string },
  ) {
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
    const child = childSnap.data();
    if (!story || !style || child?.ownerUid !== uid) throw generationFailed();
    return { story, style, child };
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
    // Métrica de calidad (story_edit_rate): sin el texto, solo que se editó una página.
    await this.qaEvent(bookId, 'text_edited', { pageIndex: index });
    return this.get(uid, bookId);
  }

  async regenerate(uid: string, bookId: string, target: Target, ip: string) {
    const limits = await this.budget.limits();
    await this.budget.ensureAvailable(limits);
    const { ref, book, preview } = await this.readyBook(uid, bookId);
    if ((preview.stage ?? 'complete') !== 'complete' || !preview.cover) {
      throw new AppError(409, 'bad_request', 'Primero aprueba al personaje.');
    }
    if (target !== 'cover' && !(target < PREVIEW_ILLUSTRATED_PAGES && preview.pages[target])) {
      throw notFound();
    }
    await this.reserveRegeneration(ref, limits);

    try {
      const { story, style, child } = await this.context(uid, book, preview);
      const ai = this.providers.ai();
      const track = this.tracker(uid, bookId, limits);
      const { photo, sheet, traits, mustKeep } = await this.characterOf(
        uid,
        book,
        Number(child.age),
        ai,
        track,
      );
      const description = describeCharacter(String(child.name), sheet, traits, mustKeep);
      const storage = this.providers.storage();
      // Referencia: la lámina del personaje (las muestras anteriores a ella usan la portada).
      const reference: ImageData = {
        bytes: await storage.download({
          bucket: 'assets',
          path:
            preview.character?.imagePath ?? preview.characterImagePath ?? preview.cover.imagePath,
        }),
        mimeType: 'image/webp',
      };
      const scene =
        target === 'cover'
          ? coverScene(preview.pages[0]?.illustrationPrompt)
          : (preview.pages[target]?.illustrationPrompt ?? '');
      const companion = preview.companion ?? null;
      const companionImage: ImageData | null = companion
        ? {
            bytes: await storage.download({ bucket: 'assets', path: companion.imagePath }),
            mimeType: 'image/webp',
          }
        : null;
      const { image } = await this.illustration(ai, track, limits, {
        prompt: buildIllustrationPrompt({
          template: story.imagePromptTemplate,
          scene,
          character: companion ? `${description}\n${companionNote(companion)}` : description,
          style: style.promptModifier,
          direction: preview.artDirection,
        }),
        stylePrompt: style.promptModifier,
        character: { description, photo },
        references: companionImage ? [reference, companionImage] : [reference],
        aspectRatio: '3:4',
        // La portada y las páginas pueden ir a imprenta: 2K (~220 dpi a 21×28; DECISIONS 071).
        resolution: '2K',
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

/** Opciones editoriales del libro, con los valores por defecto para los libros anteriores. */
function editorialChoice(book: BookData) {
  return {
    length: book.length ?? null,
    textDensity: book.textDensity ?? 'balanced',
    readingLevel: book.readingLevel ?? 'developing',
    contentType: book.contentType ?? 'story',
  } as const;
}

/** Clave estable de las opciones editoriales (para saber si la muestra quedó desactualizada). */
function editorialKey(book: BookData): string {
  const choice = editorialChoice(book);
  return [
    choice.length ?? 'legacy',
    choice.textDensity,
    choice.readingLevel,
    choice.contentType,
  ].join('|');
}

/** La muestra ya no corresponde a lo que eligió el adulto en el creador. */
function isStale(preview: NonNullable<BookData['preview']>, book: BookData): boolean {
  return (
    preview.storyId !== book.storyId ||
    preview.styleId !== book.styleId ||
    preview.photoId !== characterKey(book) ||
    (preview.editorialKey ?? editorialKey(book)) !== editorialKey(book)
  );
}

/** La foto o los rasgos elegidos en el creador. */
function characterBase(book: BookData): string {
  if (book.characterMode === 'avatar') return book.avatar ? avatarKey(book.avatar) : 'avatar:none';
  return book.photoIds[0] ?? '';
}

/** Rasgos confirmados por el adulto, solo si siguen correspondiendo a la misma foto o rasgos. */
function confirmedTraits(
  book: BookData,
): { traits: CharacterTraits; mustKeep: MustKeepTrait[] } | null {
  if (!book.characterTraits || book.characterBase !== characterBase(book)) return null;
  return {
    traits: book.characterTraits,
    mustKeep: book.mustKeep ?? defaultMustKeep(book.characterTraits),
  };
}

/** Con qué personaje se generó: la foto o los rasgos elegidos, más los rasgos confirmados. */
function characterKey(book: BookData): string {
  const confirmed = confirmedTraits(book);
  const base = characterBase(book);
  return confirmed ? `${base}#${traitsKey(confirmed.traits, confirmed.mustKeep)}` : base;
}

/** Rasgos que se fijan por defecto: los que más reclaman las familias (pelo, piel, anteojos). */
function defaultMustKeep(traits: CharacterTraits): MustKeepTrait[] {
  return ['hair', 'skinTone', ...(traits.glasses ? (['glasses'] as const) : [])];
}

/** Descripción del protagonista para los prompts: rasgos confirmados primero. */
/** Hash corto de la IP con el día: limita sin guardar ni registrar la dirección. */
function hashIp(ip: string): string {
  return createHash('sha256').update(`${utcDay()}|${ip}`).digest('hex').slice(0, 16);
}
