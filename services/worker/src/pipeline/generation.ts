import { createHash } from 'node:crypto';

import { encodeIllustration, type ProviderRegistry } from '@storynido/providers';
import {
  COLLECTIONS,
  GLOBAL_DOC_ID,
  avatarToSheet,
  buildIllustrationPrompt,
  coverScene,
  describeCharacter,
  nameIssues,
  pagesOutOfRange,
  utcDay,
  type AIProvider,
  type AiUsage,
  type Avatar,
  type CharacterSheet,
  type CharacterTraits,
  type ImageData,
  type MustKeepTrait,
  type PageReview,
  type QaCode,
  type ScenePlan,
} from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import {
  HumanReviewError,
  type PageContext,
  type PipelineHandlers,
  type StepContext,
  type StepResult,
} from './handlers';

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
  const fix = hint ? ` Fix from the previous attempt: ${hint}.` : '';
  return `${prompt}${visible}${hidden}${fix} No text, letters or words anywhere in the image.`;
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
  let aiConfigCheckedAt = 0;

  /** El admin elige proveedor y modelo en aiConfig: se aplica como en la API. */
  async function ai(): Promise<AIProvider> {
    if (Date.now() - aiConfigCheckedAt > 60_000) {
      aiConfigCheckedAt = Date.now();
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
    }
    return providers.ai();
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
      await qaEvent(ctx, 'moderation_image', { pageIndex: index, attempt: attempt + 1 });
    }
    throw new Error(`La ilustración ${String(index)} no pasó la moderación.`);
  }

  // --------------------------------------------------------------- pasos

  /** G1 + G6: el personaje está aprobado y se congela lo que el adulto vio. */
  async function preparePhoto(ctx: StepContext): Promise<StepResult> {
    const orderRef = db.collection(COLLECTIONS.orders).doc(ctx.order.id);
    const existing = (await orderRef.get()).data()?.snapshot as BookSnapshot | undefined;
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
  async function generateStory(ctx: StepContext): Promise<StepResult> {
    const snapshot = await snapshotOf(ctx);
    const provider = await ai();
    let cost = 0;

    const texts = [snapshot.title, ...snapshot.pages.map((page) => page.text)];
    const names = nameIssues(texts, snapshot.requiredNames);
    if (names.length > 0) {
      await qaEvent(ctx, 'name_mismatch', { names: names.length });
      throw new HumanReviewError(
        'name_mismatch',
        'Un nombre aprobado no aparece tal cual en el texto.',
      );
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
    const snapshot = await snapshotOf(ctx);
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
      for (;;) {
        let review: PageReview | null = null;
        if (path) {
          review = await provider.text.reviewPage({
            pageIndex: index,
            text: index === 0 ? null : (snapshot.pages[index - 1]?.text ?? null),
            image: await load(path),
            reference,
            character: snapshot.character.description,
            mustKeep: snapshot.character.mustKeep,
            scene: index === 0 ? null : (snapshot.scenes?.[index - 1] ?? null),
          });
          cost += await record(ctx, 'review', review.usage);
        } else {
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
        const issues = review?.criticalIssues.join('; ') ?? '';
        const hint = issues ? issues : undefined;
        const spent = await illustrate(ctx, snapshot, index, next, 1000 * attempts + index, hint);
        cost += spent;
        repairCost += spent;
        pageRepairCost += spent;
        path = next;
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

  return {
    steps: {
      prepare_photo: preparePhoto,
      generate_story: generateStory,
      quality_check: qualityCheck,
      // Fase 10: maquetación del PDF. Fase 12: entrega digital o impresa.
      layout_pdf: (ctx) =>
        Promise.resolve({
          output: { simulated: true, pdfPath: `orders/${ctx.order.id}/book.pdf` },
        }),
      deliver: (ctx) =>
        Promise.resolve({
          output: {
            simulated: true,
            copies: ctx.order.items.reduce((sum, item) => sum + item.quantity, 0),
          },
        }),
    },
    planIllustrations: async (ctx) => (await snapshotOf(ctx)).pages.length + 1,
    illustratePage: async (ctx: PageContext) => {
      const snapshot = await snapshotOf(ctx);
      const path = `orders/${ctx.order.id}/g${String(ctx.generation)}/illustration-${String(ctx.index)}.webp`;
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
