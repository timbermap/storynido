import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  createProviderRegistry,
  providerSettingsFromEnv,
  type ProviderRegistry,
} from '@storynido/providers';
import { ProviderError, STEP_POLICIES, type PageReview, type PrintItem } from '@storynido/shared';
import { previewFingerprint } from '@storynido/shared/server';
import Fastify from 'fastify';
import { PDFDocument } from 'pdf-lib';
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

function registry(env: Record<string, string> = {}): ProviderRegistry {
  return createProviderRegistry({
    settings: providerSettingsFromEnv(env),
    mockWebhookSecret: 'test-webhook-secret',
    localStorage: {
      rootDir: mkdtempSync(path.join(tmpdir(), 'storynido-worker-test-')),
      publicBaseUrl: 'http://localhost:8080',
      secret: 'test-storage-secret',
    },
  });
}

function printer(providers: ProviderRegistry, id: string) {
  const found = providers.printer(id);
  if (!found) throw new Error(`Imprenta ${id} inactiva`);
  return found;
}

/** Ilustraciones de prueba del tamaño real: 1K (768×1024) o 2K (1800×2400). */
const webp = (hue: number, width = 768) =>
  sharp({
    create: {
      width,
      height: Math.round((width * 4) / 3),
      channels: 3,
      background: { r: hue, g: 120, b: 200 },
    },
  })
    .webp()
    .toBuffer()
    .then((buffer) => new Uint8Array(buffer));

const PAGES = [
  'Martín mira el cielo con su abuela Rosa.',
  'Martín arma un cohete de cartón.',
  'Martín vuela entre las estrellas.',
  'Martín vuelve a casa feliz.',
];

async function seedBook(
  providers: ProviderRegistry,
  overrides: Record<string, unknown> = {},
  options: { format?: string; previewWidth?: number; pages?: number } = {},
) {
  const texts = Array.from(
    { length: options.pages ?? PAGES.length },
    (_, index) => PAGES[index % PAGES.length] ?? '',
  );
  const storage = providers.storage();
  const preview = 'previews/u1/b1';
  for (const [index, name] of ['character', 'cover', 'page-0', 'page-1'].entries()) {
    await storage.upload(
      { bucket: 'assets', path: `${preview}/${name}.webp` },
      await webp(40 * index, options.previewWidth),
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
      pages: texts.map((text, index) => ({
        index,
        text,
        illustrationPrompt: `scene ${String(index + 1)}`,
        imagePath: index < 2 ? `${preview}/page-${String(index)}.webp` : null,
      })),
      plan: {
        theme: 'espacio',
        arc: 'arco',
        scenes: texts.map((_, pageIndex) => ({
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
  await db.doc('users/u1').set({ email: 'ana@storynido.test' });
  await db.doc('printOptions/MX_softcover_mock').set({
    country: 'MX',
    format: 'softcover',
    provider: 'mock',
    sku: 'photobook-softcover-210x280',
    enabled: true,
    qaSamplePassed: true,
    pages: { min: 12, max: 120, multipleOf: 2 },
    maxQuantity: 100,
    etaDaysMin: 6,
    etaDaysMax: 11,
    productionCostUsdMinor: 900,
    updatedAt: new Date(),
  });
  await db.doc('orders/o1').set({
    ownerUid: 'u1',
    bookId: 'b1',
    status: 'paid',
    channel: 'families',
    items: [{ piece: 'book', format: options.format ?? 'digital', quantity: 1 }],
    country: 'MX',
    currency: 'MXN',
    shippingAddress:
      (options.format ?? 'digital') === 'digital'
        ? null
        : {
            name: 'Ana Pérez',
            line1: 'Av. Reforma 123',
            line2: null,
            city: 'Ciudad de México',
            state: 'CDMX',
            postalCode: '06600',
            country: 'MX',
            phone: '+52 55 1234 5678',
          },
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
      continuityChecks:
        status === 'pass'
          ? []
          : [
              {
                trait: 'glasses',
                expected: 'present',
                observed: 'missing',
                confidence: 'high' as const,
              },
            ],
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
      'printOptions',
      'users',
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

    // PDF digital: portada, dedicatoria, 4 páginas, fin y contratapa; validado y guardado.
    const layout = (await step('layout_pdf')).output as unknown as {
      files: { format: string; kind: string; path: string; pages: number }[];
      preflight: string;
    };
    expect(layout.preflight).toBe('passed');
    expect(layout.files).toEqual([
      {
        format: 'digital',
        kind: 'book',
        path: 'orders/o1/g0/digital-book.pdf',
        pages: 8,
        bytes: expect.any(Number) as number,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
      },
    ]);
    expect(
      await providers.storage().exists({ bucket: 'pdfs', path: 'orders/o1/g0/digital-book.pdf' }),
    ).toBe(true);
  });

  it('impreso con las imágenes aprobadas en 1K: la maquetación lo frena por resolución', async () => {
    const providers = registry();
    await seedBook(providers, {}, { format: 'softcover', pages: 10 });
    const generate = vi.spyOn(providers.ai().image, 'generateIllustration');
    await setup(providers).run();

    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { failedStep: string }).failedStep).toBe('layout_pdf');
    expect((failed.pipeline as { error: string }).error).toContain('resolución baja en portada');
    // Las páginas nuevas sí se pidieron en 2K.
    expect(generate.mock.calls.every(([request]) => request.resolution === '2K')).toBe(true);
  });

  it('impreso en 2K: tripa y tapas validadas, con sangrado, y el pedido va a la imprenta', async () => {
    const providers = registry();
    await seedBook(providers, {}, { format: 'softcover', pages: 10, previewWidth: 1800 });
    const create = vi.spyOn(printer(providers, 'mock'), 'createOrder');
    await setup(providers).run();

    const sent = await order();
    expect(sent.status).toBe('sent_to_print');
    expect((sent.print as { externalOrderId: string }).externalOrderId).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0]?.[0];
    expect(request?.items).toMatchObject([{ format: 'softcover', pageCount: 12, quantity: 1 }]);
    expect(request?.address.postalCode).toBe('06600');
    const layout = (await step('layout_pdf')).output as unknown as {
      files: { format: string; kind: string; pages: number }[];
      printEligible: Record<string, boolean>;
    };
    expect(layout.printEligible).toEqual({ softcover: true });
    expect(layout.files.map((file) => [file.format, file.kind, file.pages])).toEqual([
      ['digital', 'book', 14],
      ['softcover', 'interior', 12],
      ['softcover', 'cover', 1],
    ]);
  });

  it('imprenta con especificación propia (como Gelato): un solo PDF con su tapa y guardas', async () => {
    const providers = registry();
    await seedBook(providers, {}, { format: 'softcover', pages: 10, previewWidth: 1800 });
    await db.doc('orders/o1').update({
      printRouting: {
        provider: 'mock',
        totalCostUsdMinor: 1450,
        etaDaysMin: 5,
        etaDaysMax: 10,
        quotes: [{ provider: 'mock', totalCostUsdMinor: 1450, etaDaysMax: 10, error: null }],
        quotedAt: new Date(),
      },
    });
    const mock = printer(providers, 'mock');
    // Pliego como el de una tapa dura de Gelato: 20 mm de vuelta y lomo de 6 mm.
    const cover = { widthMm: 478, heightMm: 326, spineLeftMm: 236, spineWidthMm: 6, edgeMm: 20 };
    const fileSpec = vi.fn((_item: PrintItem) =>
      Promise.resolve({ packaging: 'single' as const, cover }),
    );
    Object.assign(mock, { fileSpec });
    const create = vi.spyOn(mock, 'createOrder');
    await setup(providers).run();

    expect((await order()).status).toBe('sent_to_print');
    expect(fileSpec).toHaveBeenCalledWith({ format: 'softcover', pageCount: 12, quantity: 1 });
    const layout = (await step('layout_pdf')).output as unknown as {
      files: { format: string; kind: string; pages: number; printer?: string | null }[];
    };
    expect(layout.files.map((file) => [file.format, file.kind, file.pages, file.printer])).toEqual([
      ['digital', 'book', 14, undefined],
      // Tapa + guarda + 12 páginas + guarda.
      ['softcover', 'book', 15, 'mock'],
    ]);
    const request = create.mock.calls[0]?.[0];
    expect(request?.items[0]).toMatchObject({
      pageCount: 12,
      interiorPdfUrl: null,
      coverPdfUrl: null,
      bookPdfUrl: expect.stringContaining('softcover-book.pdf') as string,
    });
    const bytes = await providers
      .storage()
      .download({ bucket: 'pdfs', path: 'orders/o1/g0/softcover-book.pdf' });
    const pdf = await PDFDocument.load(bytes);
    const mm = (points: number) => Math.round(points / (72 / 25.4));
    const [first, second] = pdf.getPages();
    expect([mm(first?.getWidth() ?? 0), mm(first?.getHeight() ?? 0)]).toEqual([478, 326]);
    expect([mm(second?.getWidth() ?? 0), mm(second?.getHeight() ?? 0)]).toEqual([216, 286]);
  });

  it('la imprenta elegida al pagar rechaza el pedido: pasa a la siguiente', async () => {
    const providers = registry({ PRINT_PROVIDERS: 'mock,mock_alt' });
    await seedBook(providers, {}, { format: 'softcover', pages: 10, previewWidth: 1800 });
    const alt = (await db.doc('printOptions/MX_softcover_mock').get()).data() ?? {};
    await db.doc('printOptions/MX_softcover_mock_alt').set({ ...alt, provider: 'mock_alt' });
    // Al pagar ganó mock_alt (la más barata); mock quedó segunda.
    await db.doc('orders/o1').update({
      printRouting: {
        provider: 'mock_alt',
        totalCostUsdMinor: 1300,
        etaDaysMin: 5,
        etaDaysMax: 9,
        quotes: [
          { provider: 'mock_alt', totalCostUsdMinor: 1300, etaDaysMax: 9, error: null },
          { provider: 'mock', totalCostUsdMinor: 1450, etaDaysMax: 10, error: null },
        ],
        quotedAt: new Date(),
      },
    });
    const rejected = vi
      .spyOn(printer(providers, 'mock_alt'), 'createOrder')
      .mockRejectedValue(new ProviderError('mock_alt', 'Producto discontinuado'));
    const fallback = vi.spyOn(printer(providers, 'mock'), 'createOrder');
    await setup(providers).run();

    const sent = await order();
    expect(sent.status).toBe('sent_to_print');
    expect((sent.print as { provider: string }).provider).toBe('mock');
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('no se imprime si la imprenta no está habilitada para ese destino', async () => {
    const providers = registry();
    await seedBook(providers, {}, { format: 'softcover', pages: 10, previewWidth: 1800 });
    await db.doc('printOptions/MX_softcover_mock').update({ qaSamplePassed: false });
    const create = vi.spyOn(printer(providers, 'mock'), 'createOrder');
    await setup(providers).run();
    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { failedStep: string }).failedStep).toBe('deliver');
    expect(create).not.toHaveBeenCalled();
  });

  it('nunca se imprime un PDF distinto del maquetado', async () => {
    const providers = registry();
    await seedBook(providers, {}, { format: 'softcover', pages: 10, previewWidth: 1800 });
    const storage = providers.storage();
    // Simula que alguien cambió la tripa después de maquetarla.
    vi.spyOn(storage, 'download').mockImplementation(async (ref) => {
      const original = await (Object.getPrototypeOf(storage) as typeof storage).download.call(
        storage,
        ref,
      );
      return ref.bucket === 'pdfs' && ref.path.endsWith('softcover-interior.pdf')
        ? new Uint8Array([...original, 0])
        : original;
    });
    const create = vi.spyOn(printer(providers, 'mock'), 'createOrder');
    await setup(providers).run();
    expect((await order()).status).toBe('qa_failed');
    expect(create).not.toHaveBeenCalled();
  });

  it('si la muestra cambió después de pagar, no se fabrica (lo aprobado es lo que se recibe)', async () => {
    const providers = registry();
    await seedBook(providers);
    const book = (await db.doc('books/b1').get()).data() as {
      preview: Parameters<typeof previewFingerprint>[0];
    };
    await db.doc('orders/o1').update({
      approval: { fingerprint: previewFingerprint(book.preview), approvedAt: new Date() },
    });
    await db.doc('books/b1').update({ 'preview.title': 'Otro título' });
    await setup(providers).run();

    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { error: string }).error).toContain('nueva aprobación');
  });

  it('con la huella de lo pagado intacta, el libro avanza', async () => {
    const providers = registry();
    await seedBook(providers);
    const book = (await db.doc('books/b1').get()).data() as {
      preview: Parameters<typeof previewFingerprint>[0];
    };
    await db.doc('orders/o1').update({
      approval: { fingerprint: previewFingerprint(book.preview), approvedAt: new Date() },
    });
    await setup(providers).run();
    expect((await order()).status).toBe('ready');
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

  it('si el adulto sacó el apodo del texto, no se frena (lo aprobado manda)', async () => {
    const providers = registry();
    await seedBook(providers, { memories: { nickname: 'Tincho' } });
    await setup(providers).run();
    expect((await order()).status).toBe('ready');
    const event = (await qaCodes()).find((item) => item.code === 'name_mismatch');
    expect(event?.detail).toMatchObject({ blocking: false });
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
    expect(generate.mock.calls[2]?.[0].prompt).toContain('Make sure that: glasses present');
    // Nunca repite la descripción de la imagen fallida.
    expect(generate.mock.calls[2]?.[0].prompt).not.toContain('faltan los anteojos');
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

  it('una reparación que la moderación rechaza es un intento fallido de esa página, no del QA', async () => {
    const providers = registry();
    await seedBook(providers);
    scriptReviews(providers, { 2: ['repair'] });
    const image = providers.ai().image;
    const original = image.moderateImage.bind(image);
    let calls = 0;
    // Las 2 páginas nuevas pasan; todas las reparaciones se rechazan.
    vi.spyOn(image, 'moderateImage').mockImplementation(async (data) => {
      calls += 1;
      return calls <= 2 ? original(data) : { allowed: false, categories: ['test'] };
    });
    await setup(providers).run();

    const failed = await order();
    expect(failed.status).toBe('qa_failed');
    expect((failed.pipeline as { error: string }).error).toContain('página 2');
    expect((await step('quality_check')).attempts).toBe(1);
    const codes = await qaCodes();
    expect(codes.filter((event) => event.code === 'moderation_image')).toHaveLength(4);
    expect(codes.find((event) => event.code === 'page_human_review')?.detail).toMatchObject({
      pageIndex: 2,
      attemptCount: 2,
    });
  });

  it('la recompra reutiliza el libro ya generado: ninguna llamada a la IA', async () => {
    const providers = registry();
    await seedBook(providers, {}, { format: 'softcover', pages: 10, previewWidth: 1800 });
    const { pipeline, run } = setup(providers);
    await run();
    expect((await order()).status).toBe('sent_to_print');

    const source = await order();
    await db.doc('orders/o2').set({
      ownerUid: 'u1',
      bookId: 'b1',
      status: 'paid',
      channel: 'families',
      items: [{ piece: 'book', format: 'digital', quantity: 1 }],
      country: 'MX',
      currency: 'MXN',
      shippingAddress: null,
      costsUsdMicros: { ai: 0, print: 0, shipping: 0 },
      pipeline: { generation: 0, runId: null, failedStep: null },
      sourceOrderId: 'o1',
      snapshot: source.snapshot as unknown,
      snapshotHash: source.snapshotHash as unknown,
    });
    const ai = providers.ai();
    const spies = [
      vi.spyOn(ai.text, 'moderateText'),
      vi.spyOn(ai.text, 'reviewPage'),
      vi.spyOn(ai.text, 'generateStory'),
      vi.spyOn(ai.image, 'generateIllustration'),
      vi.spyOn(ai.image, 'moderateImage'),
    ];
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o2', requestId: 'r2' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    for (let i = 0; i < 200; i += 1) {
      const status = (await db.doc('orders/o2').get()).get('status') as string;
      if (status === 'ready' || status === 'qa_failed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect((await db.doc('orders/o2').get()).get('status')).toBe('ready');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    const layout = (await db.doc('orders/o2/steps/layout_pdf').get()).get('output') as {
      files: { format: string }[];
    };
    expect(layout.files.map((file) => file.format)).toEqual(['digital']);
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
