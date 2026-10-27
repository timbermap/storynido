import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  createProviderRegistry,
  providerSettingsFromEnv,
  type ProviderRegistry,
} from '@storynido/providers';
import { STEP_POLICIES, type PageReview } from '@storynido/shared';
import Fastify from 'fastify';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BookSnapshot } from './generation';
import { generationHandlers } from './generation';
import { InlineDispatcher, LocalOrchestrator } from './orchestrators';
import { Pipeline } from './pipeline';

const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-storynido-test' }));
const log = Fastify({ logger: false }).log;

function registry(): ProviderRegistry {
  return createProviderRegistry({
    settings: providerSettingsFromEnv({}),
    mockWebhookSecret: 'test-webhook-secret',
    localStorage: {
      rootDir: mkdtempSync(path.join(tmpdir(), 'storynido-worker-test-')),
      publicBaseUrl: 'http://localhost:8080',
      secret: 'test-storage-secret',
    },
  });
}

const webp = (hue: number) =>
  sharp({ create: { width: 48, height: 64, channels: 3, background: { r: hue, g: 120, b: 200 } } })
    .webp()
    .toBuffer()
    .then((buffer) => new Uint8Array(buffer));

const PAGES = [
  'Martín mira el cielo con su abuela Rosa.',
  'Martín arma un cohete de cartón.',
  'Martín vuela entre las estrellas.',
  'Martín vuelve a casa feliz.',
];

async function seedBook(providers: ProviderRegistry, overrides: Record<string, unknown> = {}) {
  const storage = providers.storage();
  const preview = 'previews/u1/b1';
  for (const [index, name] of ['character', 'cover', 'page-0', 'page-1'].entries()) {
    await storage.upload(
      { bucket: 'assets', path: `${preview}/${name}.webp` },
      await webp(40 * index),
      'image/webp',
    );
  }
  await db.doc('children/c1').set({ ownerUid: 'u1', name: 'Martín', age: 5 });
  await db.doc('stories/aventura').set({
    slug: 'aventura',
    imagePromptTemplate: '{{scene}} | {{character}} | {{style}}',
  });
  await db
    .doc('illustrationStyles/acuarela')
    .set({ slug: 'acuarela', promptModifier: 'watercolor' });
  await db.doc('books/b1').set({
    ownerUid: 'u1',
    childId: 'c1',
    language: 'es',
    characterMode: 'avatar',
    avatar: {
      skinTone: 'medium',
      hairColor: 'black',
      hairLength: 'short',
      hairType: 'curly',
      eyeColor: 'brown',
      glasses: true,
    },
    contentType: 'story',
    readingLevel: 'developing',
    status: 'ordered',
    preview: {
      stage: 'complete',
      title: 'La aventura de Martín',
      storyId: 'aventura',
      styleId: 'acuarela',
      cover: { imagePath: `${preview}/cover.webp` },
      character: {
        imagePath: `${preview}/character.webp`,
        traits: {
          skinTone: 'medium',
          hairColor: 'black',
          hairLength: 'short',
          hairType: 'curly',
          eyeColor: 'brown',
          glasses: true,
          distinctive: null,
        },
        mustKeep: ['hair', 'glasses'],
        approvedAt: new Date(),
      },
      pages: PAGES.map((text, index) => ({
        index,
        text,
        illustrationPrompt: `scene ${String(index + 1)}`,
        imagePath: index < 2 ? `${preview}/page-${String(index)}.webp` : null,
      })),
      plan: {
        theme: 'espacio',
        arc: 'arco',
        scenes: PAGES.map((_, pageIndex) => ({
          pageIndex,
          sceneGoal: 'meta',
          emotionalBeat: 'alegría',
          mustBeVisible: ['rocket'],
          notVisible: ['text'],
          continuityFacts: [],
          wordBudget: 10,
          personalDetail: null,
        })),
      },
      words: { min: 5, max: 60 },
      activityPages: 0,
    },
    ...overrides,
  });
  await db.doc('orders/o1').set({
    ownerUid: 'u1',
    bookId: 'b1',
    status: 'paid',
    channel: 'families',
    items: [{ piece: 'book', format: 'hardcover', quantity: 1 }],
    costsUsdMicros: { ai: 0, print: 0, shipping: 0 },
    pipeline: { generation: 0, runId: null, failedStep: null },
  });
}

function setup(providers: ProviderRegistry) {
  const current = (): Pipeline => pipeline;
  const orchestrator = new LocalOrchestrator(current, log, 1);
  const dispatcher = new InlineDispatcher(current, log, 1);
  const pipeline = new Pipeline(
    db,
    generationHandlers({ db, providers, log, allowSimulated: true }),
    orchestrator,
    dispatcher,
    log,
  );
  const run = async (type: 'order.paid' | 'order.regenerate' = 'order.paid', requestId = 'r1') => {
    await pipeline.handleEvent({ type, orderId: 'o1', requestId });
    await orchestrator.idle();
    await dispatcher.idle();
  };
  return { pipeline, run };
}

const order = async () => (await db.doc('orders/o1').get()).data() ?? {};
const step = async (name: string) => (await db.doc(`orders/o1/steps/${name}`).get()).data() ?? {};
const qaCodes = async () =>
  (await db.collection('books/b1/qaEvents').get()).docs.map((doc) => ({
    code: doc.get('code') as string,
    detail: doc.get('detail') as Record<string, unknown>,
  }));

/** Revisión de página controlada por el test (por índice y por intento). */
function scriptReviews(
  providers: ProviderRegistry,
  script: Record<number, PageReview['status'][]>,
) {
  const text = providers.ai().text;
  const original = text.reviewPage.bind(text);
  const seen = new Map<number, number>();
  return vi.spyOn(text, 'reviewPage').mockImplementation(async (request) => {
    const base = await original(request);
    const count = seen.get(request.pageIndex) ?? 0;
    seen.set(request.pageIndex, count + 1);
    const status = script[request.pageIndex]?.[count] ?? 'pass';
    return {
      ...base,
      status,
      criticalIssues: status === 'pass' ? [] : ['faltan los anteojos'],
      repairTarget: status === 'repair' ? 'illustration_only' : 'none',
    };
  });
}

describe('generación del libro (fase 09)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    for (const name of [
      'orders',
      'books',
      'children',
      'stories',
      'illustrationStyles',
      'aiUsage',
      'aiBudget',
      'adminAlerts',
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it('de paid a ready: congela lo aprobado, reutiliza las 3 imágenes de la muestra y genera el resto', async () => {
    const providers = registry();
    await seedBook(providers);
    const generate = vi.spyOn(providers.ai().image, 'generateIllustration');
    const reviews = vi.spyOn(providers.ai().text, 'reviewPage');
    await setup(providers).run();

    const done = await order();
    expect(done.status).toBe('ready');
    const snapshot = done.snapshot as BookSnapshot;
    expect(snapshot.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.pages.map((page) => page.text)).toEqual(PAGES);
    expect(snapshot.character.mustKeep).toEqual(['hair: short curly black', 'glasses: present']);
    expect(Object.keys(snapshot.approved).sort()).toEqual(['0', '1', '2']);

    // Portada + 2 páginas aprobadas se copian; solo se pintan las páginas 3 y 4.
    expect(generate).toHaveBeenCalledTimes(2);
    const prompt = generate.mock.calls[0]?.[0].prompt ?? '';
    expect(prompt).toContain('Must be visible: rocket');
    expect(prompt).toContain('No text');
    expect(generate.mock.calls[0]?.[0].references).toHaveLength(1);
    // Cada página (5) se revisa contra la lámina.
    expect(reviews).toHaveBeenCalledTimes(5);
    const qa = await step('quality_check');
    expect((qa.output as { images: unknown[] }).images).toHaveLength(5);

    const usage = await db.collection('aiUsage').where('orderId', '==', 'o1').get();
    expect(new Set(usage.docs.map((doc) => doc.get('kind') as string))).toEqual(
      new Set(['moderation', 'illustration', 'review']),
    );
  });

  it('sin personaje aprobado: revisión manual sin reintentos', async () => {
    const providers = registry();
    await seedBook(providers);
    await db.doc('books/b1').update({ 'preview.character.approvedAt': null });
    await setup(providers).run();

    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { failedStep: string }).failedStep).toBe('prepare_photo');
    expect((await step('prepare_photo')).attempts).toBe(1);
    expect((await db.collection('adminAlerts').get()).size).toBe(1);
  });

  it('un nombre mal escrito en el texto congelado bloquea el libro (no se reescribe solo)', async () => {
    const providers = registry();
    await seedBook(providers);
    // El texto aprobado dice "Martin" sin tilde en la página 3 (pages es un array: va entero).
    const book = (await db.doc('books/b1').get()).data() as {
      preview: { pages: { text: string }[] };
    };
    const pages = book.preview.pages.map((page, index) =>
      index === 2 ? { ...page, text: 'Martin vuela entre las estrellas.' } : page,
    );
    await db.doc('books/b1').update({ 'preview.pages': pages });
    await setup(providers).run();

    expect((await order()).status).toBe('qa_failed');
    expect((await step('generate_story')).attempts).toBe(1);
    expect((await qaCodes()).map((event) => event.code)).toContain('name_mismatch');
  });

  it('una página que falla la revisión se repara sola, sin tocar las demás', async () => {
    const providers = registry();
    await seedBook(providers);
    scriptReviews(providers, { 3: ['repair', 'pass'] });
    const generate = vi.spyOn(providers.ai().image, 'generateIllustration');
    await setup(providers).run();

    expect((await order()).status).toBe('ready');
    // 2 páginas nuevas + 1 reparación de la página 3.
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[2]?.[0].prompt).toContain(
      'Fix from the previous attempt: faltan los anteojos',
    );
    const qa = (await step('quality_check')).output as {
      repaired: number;
      images: { index: number; imagePath: string }[];
    };
    expect(qa.repaired).toBe(1);
    expect(qa.images.find((image) => image.index === 3)?.imagePath).toContain('-r1.webp');
    const repair = (await qaCodes()).find((event) => event.code === 'page_repair');
    expect(repair?.detail).toMatchObject({
      pageIndex: 3,
      attemptCount: 1,
      finalStatus: 'repaired',
    });
  });

  it('si la reparación no alcanza, la página va a una persona y el libro queda en revisión', async () => {
    const providers = registry();
    await seedBook(providers);
    scriptReviews(providers, { 2: ['repair', 'repair', 'repair'] });
    await setup(providers).run();

    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { error: string }).error).toContain('página 2');
    const human = (await qaCodes()).find((event) => event.code === 'page_human_review');
    expect(human?.detail).toMatchObject({
      pageIndex: 2,
      attemptCount: 2,
      finalStatus: 'human_review',
    });
    // No reintenta el paso entero: una falla de QA no se arregla repitiendo.
    expect((await step('quality_check')).attempts).toBe(1);
    expect(STEP_POLICIES.quality_check.maxAttempts).toBeGreaterThan(1);
  });

  it('personaje equivocado: a revisión humana sin gastar reparaciones', async () => {
    const providers = registry();
    await seedBook(providers);
    scriptReviews(providers, { 1: ['human_review'] });
    const generate = vi.spyOn(providers.ai().image, 'generateIllustration');
    await setup(providers).run();

    expect((await order()).status).toBe('qa_failed');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('una imagen que no pasa la moderación se vuelve a pedir', async () => {
    const providers = registry();
    await seedBook(providers);
    const image = providers.ai().image;
    const original = image.moderateImage.bind(image);
    let rejected = false;
    vi.spyOn(image, 'moderateImage').mockImplementation(async (data) => {
      if (!rejected) {
        rejected = true;
        return { allowed: false, categories: ['test'] };
      }
      return original(data);
    });
    await setup(providers).run();

    expect((await order()).status).toBe('ready');
    expect((await qaCodes()).map((event) => event.code)).toContain('moderation_image');
  });

  it('en un ambiente real nunca usa la IA simulada (el libro no se pinta con placeholders)', async () => {
    const providers = registry();
    await seedBook(providers);
    const current = (): Pipeline => pipeline;
    const orchestrator = new LocalOrchestrator(current, log, 1);
    const dispatcher = new InlineDispatcher(current, log, 1);
    const pipeline = new Pipeline(
      db,
      generationHandlers({ db, providers, log, allowSimulated: false }),
      orchestrator,
      dispatcher,
      log,
    );
    const generate = vi.spyOn(providers.ai().image, 'generateIllustration');
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' });
    await orchestrator.idle();
    await dispatcher.idle();

    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { error: string }).error).toContain('IA simulada');
    expect(generate).not.toHaveBeenCalled();
  });

  it('una revisión que se cuelga una vez se reintenta; si sigue, solo esa página va a una persona', async () => {
    const providers = registry();
    await seedBook(providers);
    const text = providers.ai().text;
    const original = text.reviewPage.bind(text);
    const failures = new Map<number, number>([
      [1, 1],
      [3, 99],
    ]);
    const reviews = vi.spyOn(text, 'reviewPage').mockImplementation(async (request) => {
      const left = failures.get(request.pageIndex) ?? 0;
      if (left > 0) {
        failures.set(request.pageIndex, left - 1);
        throw new Error('The operation was aborted due to timeout');
      }
      return original(request);
    });
    await setup(providers).run();

    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { error: string }).error).toContain('página 3');
    // Sin reintentar el paso entero: las demás páginas se revisaron una sola vez.
    expect((await step('quality_check')).attempts).toBe(1);
    expect(reviews.mock.calls.filter(([request]) => request.pageIndex === 0)).toHaveLength(1);
    expect(reviews.mock.calls.filter(([request]) => request.pageIndex === 1)).toHaveLength(2);
    const human = (await qaCodes()).find((event) => event.code === 'page_human_review');
    expect(human?.detail).toMatchObject({ pageIndex: 3, reason: 'review_unavailable' });
  });

  it('regenerar no cambia lo aprobado pero vuelve a pintar todas las páginas', async () => {
    const providers = registry();
    await seedBook(providers);
    const { run } = setup(providers);
    await run();
    const hash = (await order()).snapshotHash as string;
    const generate = vi.spyOn(providers.ai().image, 'generateIllustration');
    await run('order.regenerate', 'regen-1');

    const after = await order();
    expect(after.status).toBe('ready');
    expect(after.snapshotHash).toBe(hash);
    expect(generate).toHaveBeenCalledTimes(5);
  });
});
