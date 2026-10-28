import { createHash } from 'node:crypto';

import { zipSync } from 'fflate';

import { encodeIllustration, type ProviderRegistry } from '@storynido/providers';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {
  COLLECTIONS,
  GLOBAL_DOC_ID,
  avatarToSheet,
  buildIllustrationPrompt,
  countWords,
  normalizeFirestoreData,
  ProviderError,
  bookEventSchema,
  kitSelectionSchema,
  printCandidates,
  printRoutingSchema,
  printOptionSchema,
  coverScene,
  describeCharacter,
  nameIssues,
  pagesOutOfRange,
  utcDay,
  type AIProvider,
  type ActivitySpec,
  type BookFormat,
  type Currency,
  type PrintAddress,
  type AiUsage,
  type Avatar,
  type CharacterSheet,
  type CharacterTraits,
  type ImageData,
  type MustKeepTrait,
  type PageReview,
  type QaCode,
  type ScenePlan,
  catalogPrices,
} from '@storynido/shared';
import { previewFingerprint } from '@storynido/shared/server';
import type { FastifyBaseLogger } from 'fastify';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { assembleSinglePdf } from '../pdf/assemble';
import { kitPieceDocument, type KitBook } from '../pdf/kit';
import { launchBrowser, renderPdf } from '../pdf/render';
import { textPlacements } from '../pdf/placement';
import { FORMAT_SPECS, pageSizeMm, printablePages, type FormatSpec } from '../pdf/spec';
import {
  DENSITY_LAYOUT,
  defaultCoverGeometry,
  digitalHtml,
  interiorPages,
  printCoverHtml,
  printInteriorHtml,
  type Density,
  type Lang,
  type LayoutBook,
} from '../pdf/templates';
import { effectiveDpi, validatePdf } from '../pdf/validate';
import {
  HumanReviewError,
  type PageContext,
  type PipelineHandlers,
  type StepContext,
  type StepResult,
} from './handlers';

/** Ninguno de los intentos de una ilustración pasó la moderación (con lo que se gastó). */
export class IllustrationRejectedError extends Error {
  constructor(
    readonly index: number,
    readonly costUsdMicros: number,
  ) {
    super(`La ilustración ${String(index)} no pasó la moderación.`);
    this.name = 'IllustrationRejectedError';
  }
}

/** Libro aprobado y congelado al empezar el pedido. El texto ya no cambia sin el adulto. */
export interface BookSnapshot {
  hash: string;
  bookId: string;
  language: string;
  title: string;
  childName: string;
  age: number;
  /** Nombres que tienen que aparecer tal cual (protagonista y apodo). */
  requiredNames: string[];
  dedication: string | null;
  contentType: string;
  readingLevel: string;
  textDensity: string;
  /** Sinopsis para la contratapa (descripción de la historia en el idioma del libro). */
  synopsis?: string | null;
  words: { min: number; max: number } | null;
  activityPages: number;
  pages: { index: number; text: string; illustrationPrompt: string }[];
  scenes: ScenePlan[] | null;
  imagePromptTemplate: string;
  stylePrompt: string;
  character: { description: string; mustKeep: string[]; sheetPath: string };
  /** Ilustraciones aprobadas en la vista previa, copiadas al pedido: índice -> ruta. */
  approved: Record<string, string>;
}

export interface QaLimits {
  /** Reparaciones por página antes de derivar a una persona. */
  repairsPerPage: number;
  /** Reparaciones por libro: mínimo, o esta fracción de las páginas. */
  minRepairsPerBook: number;
  repairShare: number;
  /** Tope de gasto en reparaciones por libro, en millonésimas de dólar. */
  repairBudgetUsdMicros: number;
  /** Páginas revisadas en paralelo. */
  concurrency: number;
}

export const DEFAULT_QA_LIMITS: QaLimits = {
  repairsPerPage: 2,
  minRepairsPerBook: 3,
  repairShare: 0.3,
  repairBudgetUsdMicros: 1_500_000,
  concurrency: 4,
};

const ASSETS = 'assets' as const;
const WEBP = 'image/webp';

interface Deps {
  db: Firestore;
  providers: ProviderRegistry;
  log: FastifyBaseLogger;
  qa?: Partial<QaLimits>;
  /** Solo en local y en tests: permite los proveedores simulados. */
  allowSimulated?: boolean;
  /** Dominio de la marca para el QR de la contratapa. */
  brandDomain?: string;
}

/** Un PDF maquetado y validado (lo usa la entrega). */
export interface LayoutFile {
  format: BookFormat;
  kind: string;
  path: string;
  pages: number;
  bytes: number;
  sha256: string;
  /** Imprenta para la que se maquetó; null o ausente: archivos genéricos. */
  printer?: string | null;
}

/** El pedido tiene al menos un libro impreso. */
export function isPrint(order: { items: { format: string }[] }): boolean {
  return order.items.some((item) => item.format !== 'digital');
}

/** Rasgos esenciales en frases, para la revisión de cada página. */
export function mustKeepLabels(traits: CharacterTraits, mustKeep: readonly MustKeepTrait[]) {
  return mustKeep.flatMap((trait) => {
    switch (trait) {
      case 'hair':
        return [
          `hair: ${traits.hairLength} ${traits.hairType} ${traits.hairColor.replace('-', ' ')}`,
        ];
      case 'skinTone':
        return [`skin tone: ${traits.skinTone}`];
      case 'eyeColor':
        return [`eyes: ${traits.eyeColor}`];
      case 'glasses':
        return [`glasses: ${traits.glasses ? 'present' : 'absent'}`];
      case 'distinctive':
        return traits.distinctive ? [`distinctive: ${traits.distinctive}`] : [];
    }
  });
}

/** Escena de una página con lo que el plan pide ver y evitar. */
function pageScene(prompt: string, scene: ScenePlan | null | undefined, hint?: string): string {
  const visible = scene?.mustBeVisible.length
    ? ` Must be visible: ${scene.mustBeVisible.join(', ')}.`
    : '';
  const hidden = scene?.notVisible.length ? ` Do not show: ${scene.notVisible.join(', ')}.` : '';
  const fix = hint
    ? ` Make sure that: ${hint}. Draw exactly this scene, with the protagonist clearly visible.`
    : '';
  // Espacio calmo para el texto: se alterna arriba y abajo para que las páginas no sean iguales.
  const calm =
    scene && scene.pageIndex % 2 === 1
      ? ' Keep the top third of the image calm and simple (sky, wall or soft background) for the text, with no faces there.'
      : ' Keep the bottom third of the image calm and simple (floor, grass or soft background) for the text, with no faces there.';
  return `${prompt}${visible}${hidden}${fix}${scene ? calm : ''} No text, letters or words anywhere in the image.`;
}

function hashSnapshot(snapshot: Omit<BookSnapshot, 'hash'>): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

async function pool<T>(items: readonly T[], size: number, run: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item);
    }),
  );
}

/**
 * Pasos reales del pipeline (fase 09): congelar lo aprobado, verificar el texto, ilustrar cada
 * página con la lámina como referencia y revisar cada página con reparaciones localizadas.
 * La maquetación (fase 10) y la entrega (fase 12) siguen simuladas.
 */
export function generationHandlers(deps: Deps): PipelineHandlers {
  const { db, providers, log } = deps;
  const limits = { ...DEFAULT_QA_LIMITS, ...deps.qa };
  const storage = () => providers.storage();
  let aiConfig: { loadedAt: number; ready: Promise<void> } | null = null;

  /** Lee aiConfig y aplica el proveedor y los modelos que eligió el admin (como la API). */
  async function loadAiConfig(): Promise<void> {
    const config = (await db.collection(COLLECTIONS.aiConfig).doc(GLOBAL_DOC_ID).get()).data();
    const field = (name: string) => {
      const value: unknown = config?.[name];
      return typeof value === 'string' && value !== '' ? value : undefined;
    };
    try {
      providers.setAiOverride({
        text: field('textProvider'),
        image: field('imageProvider'),
        textModel: field('textModel'),
        imageModel: field('imageModel'),
      });
    } catch (error) {
      log.error({ err: error }, 'ai config rejected; keeping previous providers');
    }
    // Precios del catálogo del admin: el costo de cada llamada (y el presupuesto) los usa.
    const models = await db.collection(COLLECTIONS.aiModels).get();
    providers.setModelPrices(catalogPrices(models.docs.map((doc) => doc.data())));
  }

  /**
   * Proveedor de IA vigente. Todas las páginas que arrancan juntas esperan la misma lectura de
   * aiConfig (antes, las que llegaban mientras se leía usaban el proveedor por defecto).
   */
  async function ai(): Promise<AIProvider> {
    if (!aiConfig || Date.now() - aiConfig.loadedAt > 60_000) {
      aiConfig = { loadedAt: Date.now(), ready: loadAiConfig() };
    }
    await aiConfig.ready;
    const provider = providers.ai();
    // En un ambiente real nunca se pinta ni se revisa un libro con la IA simulada.
    if (!deps.allowSimulated && (provider.text.id === 'mock' || provider.image.id === 'mock')) {
      throw new Error('La IA simulada no está permitida en este ambiente (revisar aiConfig).');
    }
    return provider;
  }

  /** Cada llamada queda en aiUsage (con el pedido) y en el gasto del día. Devuelve el costo. */
  async function record(
    ctx: StepContext,
    kind: 'story' | 'review' | 'illustration' | 'moderation',
    usage: AiUsage | undefined,
  ): Promise<number> {
    if (!usage) return 0;
    const day = utcDay();
    const batch = db.batch();
    batch.create(db.collection(COLLECTIONS.aiUsage).doc(), {
      day,
      kind,
      provider: usage.provider,
      model: usage.model,
      costUsdMicros: usage.costUsdMicros,
      ownerUid: ctx.order.ownerUid,
      bookId: ctx.order.bookId,
      orderId: ctx.order.id,
      at: new Date(),
    });
    batch.set(
      db.collection(COLLECTIONS.aiBudget).doc(day),
      { spentUsdMicros: FieldValue.increment(usage.costUsdMicros), calls: FieldValue.increment(1) },
      { merge: true },
    );
    await batch.commit();
    return usage.costUsdMicros;
  }

  async function qaEvent(
    ctx: StepContext,
    code: QaCode,
    detail: Record<string, number | boolean | string>,
  ): Promise<void> {
    await db
      .collection(COLLECTIONS.books)
      .doc(ctx.order.bookId)
      .collection(COLLECTIONS.qaEvents)
      .add({ code, at: new Date(), detail: { orderId: ctx.order.id, ...detail } });
  }

  async function snapshotOf(ctx: StepContext): Promise<BookSnapshot> {
    const data = (await db.collection(COLLECTIONS.orders).doc(ctx.order.id).get()).data();
    const snapshot = data?.snapshot as BookSnapshot | undefined;
    if (!snapshot) throw new Error('El pedido no tiene el libro congelado (prepare_photo).');
    return snapshot;
  }

  async function copy(from: string, to: string): Promise<void> {
    const bytes = await storage().download({ bucket: ASSETS, path: from });
    await storage().upload({ bucket: ASSETS, path: to }, bytes, WEBP);
  }

  async function load(path: string): Promise<ImageData> {
    return { bytes: await storage().download({ bucket: ASSETS, path }), mimeType: WEBP };
  }

  /** Una ilustración nueva con la lámina como referencia, moderada (2 intentos). */
  async function illustrate(
    ctx: StepContext,
    snapshot: BookSnapshot,
    index: number,
    path: string,
    seed: number,
    hint?: string,
  ): Promise<number> {
    const provider = await ai();
    const page = index === 0 ? null : snapshot.pages[index - 1];
    const scene =
      index === 0
        ? pageScene(coverScene(snapshot.title, snapshot.pages[0]?.illustrationPrompt), null, hint)
        : pageScene(page?.illustrationPrompt ?? '', snapshot.scenes?.[index - 1], hint);
    const reference = await load(snapshot.character.sheetPath);
    let cost = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const image = await provider.image.generateIllustration({
        prompt: buildIllustrationPrompt({
          template: snapshot.imagePromptTemplate,
          scene,
          character: snapshot.character.description,
          style: snapshot.stylePrompt,
        }),
        stylePrompt: snapshot.stylePrompt,
        character: { description: snapshot.character.description, photo: null },
        references: [reference],
        aspectRatio: '3:4',
        // Los pedidos impresos se ilustran en 2K (~220 dpi a 21×28 cm; DECISIONS 069).
        resolution: isPrint(ctx.order) ? '2K' : '1K',
        seed: seed + attempt,
      });
      cost += await record(ctx, 'illustration', image.usage);
      const verdict = await provider.image.moderateImage(image);
      cost += await record(ctx, 'moderation', verdict.usage);
      if (verdict.allowed) {
        await storage().upload(
          { bucket: ASSETS, path },
          await encodeIllustration(image.bytes),
          WEBP,
        );
        return cost;
      }
      await qaEvent(ctx, 'moderation_image', {
        pageIndex: index,
        attempt: attempt + 1,
        categories: verdict.categories.join(',').slice(0, 80),
      });
    }
    throw new IllustrationRejectedError(index, cost);
  }

  // --------------------------------------------------------------- pasos

  /** G1 + G6: el personaje está aprobado y se congela lo que el adulto vio. */
  async function preparePhoto(ctx: StepContext): Promise<StepResult> {
    const orderRef = db.collection(COLLECTIONS.orders).doc(ctx.order.id);
    const orderData = (await orderRef.get()).data();
    const existing = orderData?.snapshot as BookSnapshot | undefined;
    // Regenerar no cambia lo aprobado: el libro congelado se conserva.
    if (existing) return { output: { snapshotHash: existing.hash, frozen: false } };

    const book = (await db.collection(COLLECTIONS.books).doc(ctx.order.bookId).get()).data();
    const preview = book?.preview as
      | {
          stage?: string;
          title: string;
          storyId: string;
          styleId: string;
          pages: {
            index: number;
            text: string;
            illustrationPrompt: string;
            imagePath: string | null;
          }[];
          cover: { imagePath: string } | null;
          character?: {
            imagePath: string;
            traits: CharacterTraits;
            mustKeep: MustKeepTrait[];
            approvedAt: unknown;
          };
          plan?: { scenes: ScenePlan[] } | null;
          words?: { min: number; max: number };
          activityPages?: number;
        }
      | undefined;
    if (!book || preview?.stage !== 'complete' || !preview.character?.approvedAt) {
      throw new HumanReviewError(
        'character_not_approved',
        'El libro no tiene el personaje aprobado por el adulto.',
      );
    }
    // Lo que se pagó es lo que se fabrica: si la muestra cambió después de pagar, no se sigue.
    const approval = orderData?.approval as { fingerprint?: string } | null | undefined;
    if (approval?.fingerprint && approval.fingerprint !== previewFingerprint(preview)) {
      await qaEvent(ctx, 'snapshot_mismatch', { step: 'prepare_photo' });
      throw new HumanReviewError(
        'approval_changed',
        'La muestra cambió después del pago: hace falta una nueva aprobación.',
      );
    }
    const [childSnap, storySnap, styleSnap] = await Promise.all([
      db.collection(COLLECTIONS.children).doc(String(book.childId)).get(),
      db.collection(COLLECTIONS.stories).where('slug', '==', preview.storyId).limit(1).get(),
      db
        .collection(COLLECTIONS.illustrationStyles)
        .where('slug', '==', preview.styleId)
        .limit(1)
        .get(),
    ]);
    const child = childSnap.data();
    const story = storySnap.docs[0]?.data();
    const style = styleSnap.docs[0]?.data();
    if (!child || !story || !style)
      throw new Error('Falta el protagonista, la historia o el estilo.');

    const age = Number(child.age);
    let sheet: CharacterSheet;
    if (book.characterMode === 'avatar' && book.avatar) {
      sheet = avatarToSheet(book.avatar as Avatar, age);
    } else {
      const photo = (
        await db
          .collection(COLLECTIONS.photos)
          .doc(String((book.photoIds as string[])[0]))
          .get()
      ).data();
      sheet =
        (photo?.characterSheet as CharacterSheet | undefined) ??
        avatarToSheet({ ...preview.character.traits }, age);
    }
    const { traits, mustKeep } = preview.character;
    const name = String(child.name);

    // Lo aprobado sale de previews/ (se borra a los 30 días) y queda con el pedido.
    const base = `orders/${ctx.order.id}/approved`;
    const sheetPath = `${base}/character.webp`;
    await copy(preview.character.imagePath, sheetPath);
    const approved: Record<string, string> = {};
    const sources: [number, string | null | undefined][] = [
      [0, preview.cover?.imagePath],
      ...preview.pages.map((page, index) => [index + 1, page.imagePath] as [number, string | null]),
    ];
    for (const [index, from] of sources) {
      if (!from) continue;
      const to = `${base}/illustration-${String(index)}.webp`;
      await copy(from, to);
      approved[String(index)] = to;
    }

    const memories = book.memories as { nickname?: string | null } | null | undefined;
    const content: Omit<BookSnapshot, 'hash'> = {
      bookId: ctx.order.bookId,
      language: String(book.language),
      title: preview.title,
      childName: name,
      age,
      requiredNames: [name, memories?.nickname ?? ''].filter(Boolean),
      dedication: typeof book.dedication === 'string' ? book.dedication : null,
      contentType: String(book.contentType ?? 'story'),
      readingLevel: String(book.readingLevel ?? 'developing'),
      textDensity: String(book.textDensity ?? 'balanced'),
      synopsis:
        (story.description as Record<string, string> | undefined)?.[String(book.language)] ?? null,
      words: preview.words ?? null,
      activityPages: preview.activityPages ?? 0,
      pages: preview.pages.map(({ index, text, illustrationPrompt }) => ({
        index,
        text,
        illustrationPrompt,
      })),
      scenes: preview.plan?.scenes ?? null,
      imagePromptTemplate: String(story.imagePromptTemplate),
      stylePrompt: String(style.promptModifier),
      character: {
        description: describeCharacter(name, sheet, traits, mustKeep),
        mustKeep: mustKeepLabels(traits, mustKeep),
        sheetPath,
      },
      approved,
    };
    const snapshot: BookSnapshot = { ...content, hash: hashSnapshot(content) };
    await orderRef.update({ snapshot, snapshotHash: snapshot.hash });
    return {
      output: {
        snapshotHash: snapshot.hash,
        frozen: true,
        pages: snapshot.pages.length,
        approvedImages: Object.keys(approved).length,
      },
    };
  }

  /** G2 + G3 sobre el texto congelado (no se reescribe) y actividades si corresponden. */
  /** Ilustraciones finales (revisadas) del pedido original de una recompra. */
  async function sourceImages(ctx: StepContext): Promise<Map<number, string>> {
    const source = ctx.order.sourceOrderId ?? '';
    const qa = (
      await db
        .collection(COLLECTIONS.orders)
        .doc(source)
        .collection(COLLECTIONS.orderSteps)
        .doc('quality_check')
        .get()
    ).data() as { output?: { images?: { index: number; imagePath: string }[] } } | undefined;
    const images = new Map(
      (qa?.output?.images ?? []).map((image) => [image.index, image.imagePath]),
    );
    if (images.size === 0)
      throw new HumanReviewError(
        'reorder_source',
        'El pedido original no tiene el libro terminado.',
      );
    return images;
  }

  async function generateStory(ctx: StepContext): Promise<StepResult> {
    // Recompra: el texto es el mismo libro ya revisado; no se vuelve a llamar a la IA.
    if (ctx.order.sourceOrderId) {
      const snapshot = await snapshotOf(ctx);
      return { output: { pages: snapshot.pages.length, reused: true } };
    }
    const snapshot = await snapshotOf(ctx);
    const provider = await ai();
    let cost = 0;

    const texts = [snapshot.title, ...snapshot.pages.map((page) => page.text)];
    // El texto es el que aprobó el adulto: si sacó el apodo, es su decisión (se registra). Un
    // nombre mal escrito ("Martin" por "Martín") sí frena: es un error que se le pudo pasar.
    const names = nameIssues(texts, snapshot.requiredNames);
    if (names.length > 0) {
      const misspelled = names.filter((issue) => issue.problem === 'misspelled');
      await qaEvent(ctx, 'name_mismatch', {
        names: names.length,
        misspelled: misspelled.length,
        blocking: misspelled.length > 0,
      });
      if (misspelled.length > 0) {
        throw new HumanReviewError(
          'name_mismatch',
          'Un nombre aprobado aparece mal escrito en el texto.',
        );
      }
    }
    if (snapshot.scenes && snapshot.scenes.length !== snapshot.pages.length) {
      await qaEvent(ctx, 'snapshot_mismatch', {
        scenes: snapshot.scenes.length,
        pages: snapshot.pages.length,
      });
    }
    // El adulto pudo editar el texto: fuera de rango se registra, no bloquea.
    const outOfRange = snapshot.words ? pagesOutOfRange(snapshot.pages, snapshot.words) : [];
    if (outOfRange.length > 0) {
      await qaEvent(ctx, 'length_out_of_range', { pages: outOfRange.length });
    }
    const verdict = await provider.text.moderateText(texts.join('\n\n'));
    cost += await record(ctx, 'moderation', verdict.usage);
    if (!verdict.allowed) {
      await qaEvent(ctx, 'moderation_text', {
        categories: verdict.categories.join(',').slice(0, 80),
      });
      throw new HumanReviewError(
        'moderation_text',
        'El texto aprobado no pasó la revisión de seguridad.',
      );
    }

    let activities = 0;
    if (snapshot.activityPages > 0) {
      const templates = (
        await db.collection(COLLECTIONS.activityTemplates).where('active', '==', true).get()
      ).docs
        .map((doc) => doc.data())
        .filter((template) => (template.readingLevels as string[]).includes(snapshot.readingLevel))
        .map((template) => ({
          kind: String(template.kind),
          guidance: String(template.promptGuidance),
        }));
      const generated = await provider.text.generateActivities({
        language: snapshot.language as 'es' | 'en' | 'pt',
        childName: snapshot.childName,
        age: snapshot.age,
        readingLevel: snapshot.readingLevel,
        storyTitle: snapshot.title,
        storyPages: snapshot.pages.map((page) => page.text),
        templates,
        count: snapshot.activityPages,
        goal: null,
      });
      cost += await record(ctx, 'story', generated.usage);
      const check = await provider.text.moderateText(
        generated.activities
          .map((activity) => `${activity.title}\n${activity.instructions}`)
          .join('\n\n'),
      );
      cost += await record(ctx, 'moderation', check.usage);
      if (!check.allowed) throw new Error('Las actividades no pasaron la moderación.');
      await db
        .collection(COLLECTIONS.orders)
        .doc(ctx.order.id)
        .collection('content')
        .doc('activities')
        .set({ generation: ctx.generation, activities: generated.activities, at: new Date() });
      activities = generated.activities.length;
    }

    return {
      output: { pages: snapshot.pages.length, activities, densityWarnings: outOfRange.length },
      costUsdMicros: cost,
    };
  }

  /** G4 con reparaciones localizadas: una página con problemas no toca a las demás. */
  async function qualityCheck(ctx: StepContext): Promise<StepResult> {
    // Recompra: las páginas ya pasaron la revisión en el pedido original.
    if (ctx.order.sourceOrderId) {
      const images = (ctx.outputs.generate_illustrations?.images ?? []) as {
        index: number;
        imagePath: string;
      }[];
      return { output: { images, reviewed: 0, repaired: 0, reused: true } };
    }
    const snapshot = await snapshotOf(ctx);
    // Revisión manual: un admin vio las páginas y las aprobó para esta generación. Se aceptan
    // tal como están (sin revisión automática ni reparaciones) y el pedido sigue a la maqueta.
    const approval = ctx.order.humanApproval;
    if (approval?.generation === ctx.generation) {
      const images = (ctx.outputs.generate_illustrations?.images ?? []) as {
        index: number;
        imagePath: string;
      }[];
      if (images.length < snapshot.pages.length + 1) {
        throw new HumanReviewError('page_missing', 'Faltan ilustraciones: hay que regenerar.');
      }
      await qaEvent(ctx, 'human_approved', { pages: images.length });
      return { output: { images, reviewed: 0, repaired: 0, approvedBy: approval.by ?? 'admin' } };
    }
    const provider = await ai();
    const reference = await load(snapshot.character.sheetPath);
    const produced = new Map(
      (
        (ctx.outputs.generate_illustrations?.images ?? []) as { index: number; imagePath: string }[]
      ).map((image) => [image.index, image.imagePath]),
    );
    const total = snapshot.pages.length + 1;
    const bookRepairs = Math.max(limits.minRepairsPerBook, Math.ceil(total * limits.repairShare));
    let repairsUsed = 0;
    let repairCost = 0;
    let cost = 0;
    const finalImages = new Map<number, string>();
    const blocked: { index: number; reason: string }[] = [];
    let needsReference = 0;

    const indices = Array.from({ length: total }, (_, index) => index);
    await pool(indices, limits.concurrency, async (index) => {
      let path = produced.get(index) ?? null;
      let attempts = 0;
      let pageRepairCost = 0;
      // Si una reparación no pasó la moderación, se reintenta con la misma revisión.
      let pending: PageReview | null = null;
      for (;;) {
        let review: PageReview | null = pending;
        pending = null;
        if (path && !review) {
          const request = {
            pageIndex: index,
            text: index === 0 ? null : (snapshot.pages[index - 1]?.text ?? null),
            image: await load(path),
            reference,
            character: snapshot.character.description,
            mustKeep: snapshot.character.mustKeep,
            scene: index === 0 ? null : (snapshot.scenes?.[index - 1] ?? null),
          };
          // Una revisión que se cuelga no tumba el control de todo el libro: 1 reintento y,
          // si sigue sin responder, esa página va a una persona.
          for (let tries = 0; tries < 2 && !review; tries += 1) {
            try {
              review = await provider.text.reviewPage(request);
            } catch (error) {
              log.warn({ orderId: ctx.order.id, index, err: error }, 'page review failed');
            }
          }
          if (!review) {
            await qaEvent(ctx, 'page_human_review', {
              pageIndex: index,
              attemptCount: attempts,
              repairCostUsdMicros: pageRepairCost,
              finalStatus: 'human_review',
              reason: 'review_unavailable',
            });
            blocked.push({ index, reason: 'revisión automática no disponible' });
            return;
          }
          cost += await record(ctx, 'review', review.usage);
        } else if (!path) {
          await qaEvent(ctx, 'page_missing', { pageIndex: index });
        }

        if (review && (review.status === 'pass' || review.status === 'needs_reference')) {
          if (review.status === 'needs_reference') {
            needsReference += 1;
            await qaEvent(ctx, 'page_needs_reference', {
              pageIndex: index,
              finalStatus: 'accepted',
            });
          }
          if (attempts > 0) {
            await qaEvent(ctx, 'page_repair', {
              pageIndex: index,
              attemptCount: attempts,
              repairCostUsdMicros: pageRepairCost,
              finalStatus: 'repaired',
            });
          }
          if (path) finalImages.set(index, path);
          return;
        }

        const unfixable =
          review !== null &&
          (review.status === 'human_review' || review.repairTarget === 'text_only');
        const canRepair =
          !unfixable &&
          attempts < limits.repairsPerPage &&
          repairsUsed < bookRepairs &&
          repairCost < limits.repairBudgetUsdMicros;
        if (!canRepair) {
          const issues = review?.criticalIssues.join('; ') ?? '';
          const reason = issues ? issues.slice(0, 200) : 'sin ilustración';
          await qaEvent(ctx, 'page_human_review', {
            pageIndex: index,
            attemptCount: attempts,
            repairCostUsdMicros: pageRepairCost,
            finalStatus: 'human_review',
          });
          blocked.push({ index, reason });
          return;
        }
        attempts += 1;
        repairsUsed += 1;
        const next = `orders/${ctx.order.id}/g${String(ctx.generation)}/illustration-${String(index)}-r${String(attempts)}.webp`;
        // La corrección dice qué tiene que verse (rasgos esperados), nunca describe la imagen
        // fallida: copiar "glifos" o "texto" de la revisión hace que el modelo los dibuje.
        const expected = (review?.continuityChecks ?? [])
          .filter((check) => check.expected !== check.observed)
          .map((check) => `${check.trait} ${check.expected}`);
        const hint = expected.length > 0 ? expected.join(', ') : 'the scene matches the page';
        try {
          const spent = await illustrate(ctx, snapshot, index, next, 1000 * attempts + index, hint);
          cost += spent;
          repairCost += spent;
          pageRepairCost += spent;
          path = next;
        } catch (error) {
          // Una reparación rechazada por la moderación es un intento fallido de esta página,
          // no del control de todo el libro.
          if (!(error instanceof IllustrationRejectedError)) throw error;
          cost += error.costUsdMicros;
          repairCost += error.costUsdMicros;
          pageRepairCost += error.costUsdMicros;
          pending = review;
        }
      }
    });

    if (blocked.length > 0) {
      log.warn({ orderId: ctx.order.id, pages: blocked.map((page) => page.index) }, 'qa blocked');
      throw new HumanReviewError(
        'qa_blocked',
        `Revisión manual: ${blocked
          .sort((a, b) => a.index - b.index)
          .map(
            (page) =>
              `${page.index === 0 ? 'portada' : `página ${String(page.index)}`} (${page.reason})`,
          )
          .join(', ')}`.slice(0, 500),
      );
    }
    return {
      output: {
        images: [...finalImages.entries()]
          .sort(([a], [b]) => a - b)
          .map(([index, imagePath]) => ({ index, imagePath })),
        reviewed: total,
        repaired: repairsUsed,
        needsReference,
        repairCostUsdMicros: repairCost,
      },
      costUsdMicros: cost,
    };
  }

  /**
   * G5 + preflight (guía G): digital siempre; tripa y tapas por cada formato impreso. Todo se
   * valida (páginas, tamaño con sangrado, tipografías, texto sin desborde, resolución) y el
   * libro congelado tiene que seguir siendo el aprobado (hash).
   */
  /** Kit de Eventos del pedido (piezas, copias, invitación, hoja) y los datos del cumpleaños. */
  async function kitOf(orderId: string) {
    const order = (await db.collection(COLLECTIONS.orders).doc(orderId).get()).data();
    const parsed = kitSelectionSchema
      .extend({ paper: z.enum(['letter', 'a4']) })
      .safeParse(order?.kit);
    if (!parsed.success) return null;
    const book = (await db.collection(COLLECTIONS.books).doc(String(order?.bookId)).get()).data();
    const event = bookEventSchema.safeParse(book?.event);
    return { ...parsed.data, event: event.success ? event.data : null };
  }

  async function layoutPdf(ctx: StepContext): Promise<StepResult> {
    const snapshot = await snapshotOf(ctx);
    const { hash, ...content } = snapshot;
    if (hashSnapshot(content) !== hash) {
      await qaEvent(ctx, 'snapshot_mismatch', { step: 'layout_pdf' });
      throw new HumanReviewError(
        'snapshot_mismatch',
        'El libro congelado no coincide con el aprobado.',
      );
    }
    const images = new Map(
      ((ctx.outputs.quality_check?.images ?? []) as { index: number; imagePath: string }[]).map(
        (image) => [image.index, image.imagePath],
      ),
    );
    const total = snapshot.pages.length + 1;
    if (images.size < total) throw new Error('Faltan ilustraciones revisadas para maquetar.');
    const activitiesDoc = (
      await db
        .collection(COLLECTIONS.orders)
        .doc(ctx.order.id)
        .collection('content')
        .doc('activities')
        .get()
    ).data();
    const activities =
      activitiesDoc?.generation === ctx.generation
        ? (activitiesDoc.activities as ActivitySpec[])
        : [];
    const sources = await Promise.all(
      Array.from({ length: total }, (_, index) =>
        storage().download({ bucket: ASSETS, path: images.get(index) ?? '' }),
      ),
    );

    // Dónde va el texto de cada página: la región más calma de su ilustración.
    const placements = await textPlacements(
      sources.slice(1).map((image, index) => ({
        image,
        words: countWords(snapshot.pages[index]?.text ?? ''),
      })),
      { allowCorners: snapshot.textDensity !== 'rich' },
    );
    const qr = {
      svg: await QRCode.toString(`https://${deps.brandDomain ?? 'storynido.com'}`, {
        type: 'svg',
        margin: 0,
        color: { dark: '#342a40', light: '#0000' },
      }),
      label: deps.brandDomain ?? 'storynido.com',
    };

    const formats: BookFormat[] = [
      'digital',
      ...new Set(
        ctx.order.items
          .map((item) => item.format as BookFormat)
          .filter((format) => format !== 'digital'),
      ),
    ];
    const files: LayoutFile[] = [];
    const printEligible: Record<string, boolean> = {};
    // Imprenta elegida al pagar (la más barata): define la tapa y cómo se entregan los archivos.
    const routing = isPrint(ctx.order)
      ? printRoutingSchema.safeParse(
          normalizeFirestoreData(
            (await db.collection(COLLECTIONS.orders).doc(ctx.order.id).get()).get('printRouting'),
          ),
        )
      : null;
    const printer = routing?.success ? providers.printer(routing.data.provider) : null;
    const problems: string[] = [];
    const base = `orders/${ctx.order.id}/g${String(ctx.generation)}`;
    // Eventos: las piezas del kit salen de la portada aprobada del librito (sin IA).
    const kit = await kitOf(ctx.order.id);
    let kitCover: string | null = null;
    const browser = await launchBrowser();
    try {
      for (const format of formats) {
        // Dedicatoria + páginas + actividades + fin (las tapas van aparte).
        const expectedInterior = snapshot.pages.length + activities.length + 2;
        // La tapa y el empaquetado los define la imprenta elegida al pagar (si tiene los suyos).
        const fileSpec =
          format !== 'digital' && printer?.fileSpec
            ? await printer.fileSpec({
                format,
                pageCount: expectedInterior,
                quantity: ctx.order.items.find((item) => item.format === format)?.quantity ?? 1,
              })
            : null;
        // Tamaño al corte y sangrado: los de la imprenta elegida (si los define).
        const spec: FormatSpec = {
          ...FORMAT_SPECS[format],
          ...(fileSpec?.trim
            ? { trimMm: { width: fileSpec.trim.widthMm, height: fileSpec.trim.heightMm } }
            : {}),
          ...(fileSpec?.bleedMm !== undefined ? { bleedMm: fileSpec.bleedMm } : {}),
        };
        // Mínimo de páginas de la imprenta (Lulu: 32 en tapa blanda): páginas para dibujar.
        const fillerPages = Math.max(0, (fileSpec?.minInteriorPages ?? 0) - expectedInterior);
        const size = pageSizeMm(spec);
        const prepared = await Promise.all(
          sources.map(async (bytes) => {
            const image = sharp(bytes);
            const { width } = await image.metadata();
            const jpeg = await image
              .resize({ width: Math.min(width, spec.maxImagePx), withoutEnlargement: true })
              .jpeg({ quality: spec.jpegQuality })
              .toBuffer();
            return {
              uri: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
              dpi: effectiveDpi(width, size.width),
            };
          }),
        );
        const lowDpi = prepared.flatMap((image, index) => (image.dpi < spec.minDpi ? [index] : []));
        if (lowDpi.length > 0) {
          problems.push(
            `${format}: resolución baja en ${lowDpi
              .map((index) => (index === 0 ? 'portada' : `página ${String(index)}`))
              .join(', ')}`,
          );
          continue;
        }
        const layout: LayoutBook = {
          language: snapshot.language as Lang,
          title: snapshot.title,
          childName: snapshot.childName,
          dedication: snapshot.dedication,
          contentType: snapshot.contentType,
          density: (snapshot.textDensity in DENSITY_LAYOUT
            ? snapshot.textDensity
            : 'balanced') as Density,
          readingLevel: snapshot.readingLevel as LayoutBook['readingLevel'],
          cover: prepared[0]?.uri ?? '',
          pages: snapshot.pages.map((page, index) => ({
            text: page.text,
            image: prepared[index + 1]?.uri ?? '',
            placement: placements[index],
          })),
          activities,
          synopsis: snapshot.synopsis ?? null,
          // Profesionales: el aviso de material educativo (no clínico) en la página final.
          educationalNotice: ctx.order.channel === 'professionals',
          fillerPages,
          qr,
        };
        if (format === 'digital') kitCover = layout.cover;
        const interiorCount = interiorPages(layout, spec).length;
        if (format !== 'digital') {
          printEligible[format] = printablePages(spec, interiorCount);
          if (!printEligible[format]) {
            problems.push(`${format}: ${String(interiorCount)} páginas no cumplen con la imprenta`);
            continue;
          }
        }
        const cover = fileSpec?.cover ?? defaultCoverGeometry(spec, interiorCount);
        const jobs =
          format === 'digital'
            ? [
                {
                  kind: 'book',
                  html: digitalHtml(layout, spec),
                  size,
                  bleedMm: spec.bleedMm,
                  pages: interiorCount + 2,
                },
              ]
            : [
                {
                  kind: 'interior',
                  html: printInteriorHtml(layout, spec),
                  size,
                  bleedMm: spec.bleedMm,
                  pages: interiorCount,
                },
                {
                  kind: 'cover',
                  html: printCoverHtml(layout, spec, cover, fileSpec?.packaging !== 'single'),
                  size: { width: cover.widthMm, height: cover.heightMm },
                  bleedMm: cover.edgeMm,
                  pages: 1,
                },
              ];
        const rendered: { kind: string; pdf: Uint8Array; pages: number }[] = [];
        for (const job of jobs) {
          const result = await renderPdf(browser, job.html, job.size, {
            bleedMm: job.bleedMm,
            title: snapshot.title,
          });
          if (result.overflow.length > 0) {
            problems.push(`${format}: el texto no entra en ${result.overflow.join(', ')}`);
            continue;
          }
          const check = await validatePdf(result.pdf, {
            pages: job.pages,
            widthMm: job.size.width,
            heightMm: job.size.height,
            bleedMm: job.bleedMm,
          });
          if (!check.ok) {
            problems.push(`${format} ${job.kind}: ${check.errors.join('; ')}`);
            continue;
          }
          rendered.push({ kind: job.kind, pdf: result.pdf, pages: check.pageCount });
        }
        if (rendered.length !== jobs.length) continue;
        const interiorPdf = rendered.find((item) => item.kind === 'interior');
        const coverPdf = rendered.find((item) => item.kind === 'cover');
        const outputs =
          fileSpec?.packaging === 'single' && interiorPdf && coverPdf
            ? [
                {
                  kind: 'book',
                  pdf: await assembleSinglePdf(coverPdf.pdf, interiorPdf.pdf),
                  // Tapa + guarda + tripa + guarda.
                  pages: interiorPdf.pages + 3,
                },
              ]
            : rendered;
        for (const output of outputs) {
          const path = `${base}/${format}-${output.kind}.pdf`;
          await storage().upload({ bucket: 'pdfs', path }, output.pdf, 'application/pdf');
          files.push({
            format,
            kind: output.kind,
            path,
            pages: output.pages,
            bytes: output.pdf.length,
            // Huella del PDF: la entrega verifica que se imprime exactamente este archivo.
            sha256: createHash('sha256').update(output.pdf).digest('hex'),
            // Para qué imprenta se maquetó (null: archivos genéricos que sirven a cualquiera).
            ...(format === 'digital' ? {} : { printer: fileSpec ? (printer?.id ?? null) : null }),
          });
        }
      }
      if (kit && kitCover) {
        const kitBook: KitBook = {
          language: snapshot.language as Lang,
          childName: snapshot.childName,
          title: snapshot.title,
          turningAge: kit.event?.turningAge ?? null,
          eventDate: kit.event?.date ?? null,
          invitation: kit.invitation,
          cover: kitCover,
          paper: kit.paper,
        };
        for (const { piece, copies } of kit.pieces) {
          if (piece === 'mini_book') continue;
          const doc = kitPieceDocument(kitBook, piece, copies);
          const result = await renderPdf(browser, doc.html, doc.size, {
            bleedMm: 0,
            title: `${snapshot.title} · ${piece}`,
          });
          const check = await validatePdf(result.pdf, {
            pages: doc.pages,
            widthMm: doc.size.width,
            heightMm: doc.size.height,
            bleedMm: 0,
          });
          if (!check.ok) {
            problems.push(`kit ${piece}: ${check.errors.join('; ')}`);
            continue;
          }
          const path = `${base}/kit-${piece}.pdf`;
          await storage().upload({ bucket: 'pdfs', path }, result.pdf, 'application/pdf');
          files.push({
            format: 'digital',
            kind: piece,
            path,
            pages: check.pageCount,
            bytes: result.pdf.length,
            sha256: createHash('sha256').update(result.pdf).digest('hex'),
          });
        }
        // Todo junto en un ZIP (el librito y cada pieza), para descargar de una vez.
        const entries: Record<string, Uint8Array> = {};
        for (const file of files.filter((item) => item.format === 'digital')) {
          const name = file.kind === 'book' ? 'mini-cuento.pdf' : `${file.kind}.pdf`;
          entries[name] = await storage().download({ bucket: 'pdfs', path: file.path });
        }
        const zip = zipSync(entries, { level: 0 });
        const zipPath = `${base}/kit.zip`;
        await storage().upload({ bucket: 'pdfs', path: zipPath }, zip, 'application/zip');
        files.push({
          format: 'digital',
          kind: 'kit_zip',
          path: zipPath,
          pages: 0,
          bytes: zip.length,
          sha256: createHash('sha256').update(zip).digest('hex'),
        });
      }
    } finally {
      await browser.close();
    }

    if (problems.length > 0) {
      await qaEvent(ctx, 'layout_blocked', { problems: problems.length });
      throw new HumanReviewError(
        'layout_blocked',
        `Maquetación: ${problems.join(' · ')}`.slice(0, 500),
      );
    }
    return { output: { files, printEligible, preflight: 'passed', snapshotHash: hash } };
  }

  /**
   * Entrega: el digital queda listo (la descarga se firma al momento). Los impresos van a la
   * imprenta solo si el PDF es exactamente el maquetado del libro aprobado y la matriz lo
   * permite. El pedido de imprenta se crea una sola vez aunque el paso se reintente.
   */
  async function deliver(ctx: StepContext): Promise<StepResult> {
    const files = (ctx.outputs.layout_pdf?.files ?? []) as LayoutFile[];
    const digital = files.find((file) => file.format === 'digital');
    if (!digital) throw new Error('Falta el PDF digital maquetado.');
    const printItems = ctx.order.items.filter((item) => item.format !== 'digital');
    if (printItems.length === 0) {
      return { output: { digitalPath: digital.path, sentToPrint: false } };
    }

    const orderRef = db.collection(COLLECTIONS.orders).doc(ctx.order.id);
    const order = (await orderRef.get()).data() ?? {};
    const existing = order.print as { externalOrderId?: string | null } | null | undefined;
    if (existing?.externalOrderId) {
      return {
        output: {
          digitalPath: digital.path,
          sentToPrint: true,
          externalOrderId: existing.externalOrderId,
        },
      };
    }
    const address = order.shippingAddress as PrintAddress | null | undefined;
    if (!address)
      throw new HumanReviewError('print_address', 'El pedido impreso no tiene dirección.');

    const items = [];
    // Imprenta para la que se maquetó (null: archivos genéricos, sirven a cualquiera sin specs).
    let laidOutFor: string | null = null;
    const sevenDays = 7 * 24 * 3600;
    const signed = async (file: LayoutFile | undefined) =>
      file
        ? (await storage().signedDownloadUrl({ bucket: 'pdfs', path: file.path }, sevenDays)).url
        : null;
    for (const item of printItems) {
      const mine = files.filter((file) => file.format === item.format);
      const book = mine.find((file) => file.kind === 'book');
      const interior = mine.find((file) => file.kind === 'interior');
      const cover = mine.find((file) => file.kind === 'cover');
      if (!book && (!interior || !cover)) throw new Error(`Faltan los PDF de ${item.format}.`);
      laidOutFor = mine[0]?.printer ?? null;
      // Nunca se imprime una versión distinta de la maquetada desde lo aprobado.
      const md5 = new Map<string, string>();
      for (const file of [book, interior, cover].filter((value) => value !== undefined)) {
        const bytes = await storage().download({ bucket: 'pdfs', path: file.path });
        if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
          await qaEvent(ctx, 'snapshot_mismatch', { step: 'deliver' });
          throw new HumanReviewError('pdf_mismatch', 'El PDF de imprenta no es el maquetado.');
        }
        // Algunas imprentas verifican la descarga con el MD5 del archivo.
        md5.set(file.path, createHash('md5').update(bytes).digest('hex'));
      }
      items.push({
        format: item.format as 'softcover' | 'hardcover',
        // En un solo PDF van también la tapa y las dos guardas.
        pageCount: interior?.pages ?? (book ? book.pages - 3 : 0),
        quantity: item.quantity,
        interiorPdfUrl: await signed(interior),
        coverPdfUrl: await signed(cover),
        bookPdfUrl: await signed(book),
        interiorMd5: interior ? (md5.get(interior.path) ?? null) : null,
        coverMd5: cover ? (md5.get(cover.path) ?? null) : null,
        bookMd5: book ? (md5.get(book.path) ?? null) : null,
      });
    }
    const owner = (await db.collection(COLLECTIONS.users).doc(ctx.order.ownerUid).get()).data();
    // La imprenta elegida al pagar (la más barata); si no acepta el pedido, la siguiente.
    const routing = printRoutingSchema.safeParse(normalizeFirestoreData(order.printRouting));
    const ranked = routing.success
      ? [
          routing.data.provider,
          ...routing.data.quotes
            .filter((quoted) => quoted.error === null)
            .map((quoted) => quoted.provider),
        ]
      : providers.printers().map((printer) => printer.id);
    const options = (
      await db.collection(COLLECTIONS.printOptions).where('country', '==', address.country).get()
    ).docs.flatMap((doc) => {
      const parsed = printOptionSchema.safeParse(normalizeFirestoreData(doc.data()));
      return parsed.success ? [parsed.data] : [];
    });
    const able = printCandidates(
      options,
      items.map((item) => ({
        format: item.format,
        pages: item.pageCount,
        quantity: item.quantity,
      })),
      providers.printers().map((printer) => printer.id),
    );
    const rejected: string[] = [];
    let created: { externalOrderId: string } | null = null;
    let printerId: string | null = null;
    for (const id of [...new Set(ranked)]) {
      const printer = providers.printer(id);
      if (!printer || !able.includes(id)) {
        rejected.push(`${id}: ya no imprime este libro`);
        continue;
      }
      // Una imprenta con especificaciones propias solo recibe los archivos maquetados para ella.
      if (printer.fileSpec ? laidOutFor !== id : laidOutFor !== null) {
        rejected.push(`${id}: necesita otra maquetación`);
        continue;
      }
      try {
        created = await printer.createOrder({
          orderId: ctx.order.id,
          items,
          address,
          email: typeof owner?.email === 'string' ? owner.email : '',
          currency: (order.currency as Currency | undefined) ?? 'USD',
        });
        printerId = id;
        break;
      } catch (error) {
        // Un error reintentable (red, 5xx) reintenta el paso con la misma imprenta.
        if (!(error instanceof ProviderError) || error.retryable) throw error;
        rejected.push(`${id}: ${error.message}`);
      }
    }
    if (!created || !printerId) {
      throw new HumanReviewError(
        'print_unavailable',
        `Ninguna imprenta aceptó el pedido (${rejected.join('; ') || 'sin imprentas'}).`,
      );
    }
    if (rejected.length > 0) {
      ctx.log.warn({ orderId: ctx.order.id, printer: printerId, rejected }, 'print fallback');
    }
    await orderRef.update({
      print: {
        provider: printerId,
        externalOrderId: created.externalOrderId,
        trackingNumber: null,
        trackingUrl: null,
      },
      updatedAt: new Date(),
    });
    return {
      output: {
        digitalPath: digital.path,
        sentToPrint: true,
        externalOrderId: created.externalOrderId,
      },
    };
  }

  return {
    steps: {
      prepare_photo: preparePhoto,
      generate_story: generateStory,
      quality_check: qualityCheck,
      layout_pdf: (ctx) => layoutPdf(ctx),
      // Fase 12: entrega digital o impresa.
      deliver: (ctx) => deliver(ctx),
    },
    planIllustrations: async (ctx) => (await snapshotOf(ctx)).pages.length + 1,
    illustratePage: async (ctx: PageContext) => {
      const snapshot = await snapshotOf(ctx);
      const path = `orders/${ctx.order.id}/g${String(ctx.generation)}/illustration-${String(ctx.index)}.webp`;
      // Recompra: se copia la ilustración final del pedido original (sin IA).
      if (ctx.order.sourceOrderId) {
        const source = (await sourceImages(ctx)).get(ctx.index);
        if (!source)
          throw new HumanReviewError(
            'reorder_source',
            'Falta una ilustración del pedido original.',
          );
        await copy(source, path);
        return { imagePath: path, costUsdMicros: 0 };
      }
      const approved = snapshot.approved[String(ctx.index)];
      // Lo que el adulto ya vio y aprobó en la vista previa se reutiliza tal cual.
      if (approved && ctx.generation === 0) {
        await copy(approved, path);
        return { imagePath: path, costUsdMicros: 0 };
      }
      const cost = await illustrate(ctx, snapshot, ctx.index, path, ctx.index + 1);
      return { imagePath: path, costUsdMicros: cost };
    },
  };
}
