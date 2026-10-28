/**
 * Vista previa de punta a punta con emuladores (Firestore), storage local e IA simulada:
 * generación, cuotas, presupuesto, regeneraciones, edición moderada y configuración de IA.
 */
import type { EmailNotifier } from '@storynido/emails';
import {
  MOCK_UNSAFE_MARKER,
  signMockPaymentWebhook,
  type MockEmailProvider,
  type ProviderRegistry,
} from '@storynido/providers';
import {
  countWords,
  utcDay,
  type CountryConfig,
  type EmailMessage,
  type IllustrationStyle,
  type Lesson,
  type Price,
  type PriceSnapshot,
  type PublicOrder,
  type PublicPreview,
  type Story,
} from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryCatalog } from '../catalog';
import { RecordingConversions } from '../checkout/conversions';
import { RecordingPublisher } from '../orders/events';
import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
const t = (es: string) => ({ es, en: `${es} (en)`, pt: `${es} (pt)` });
const now = new Date();

const story: Story = {
  slug: 'aventura-espacial',
  active: true,
  order: 1,
  ageMin: 3,
  ageMax: 8,
  tags: [],
  pageCount: 4,
  title: t('La gran aventura espacial'),
  summary: t('Resumen'),
  excerpt: t('Fragmento'),
  coverImage: '/samples/aventura-espacial.webp',
  samplePages: [],
  textPromptTemplate: 'Cuento de {{pageCount}} páginas para {{childName}}. Enseñanzas: {{lessons}}',
  imagePromptTemplate: 'Scene: {{scene}}. Character: {{character}}. Style: {{style}}.',
  lengths: ['mini', 'short', 'classic', 'epic'],
  textDensities: ['visual', 'balanced', 'rich'],
  readingLevels: ['beginner', 'developing', 'advanced'],
  contentTypes: ['story', 'coloring', 'story_activities'],
  channels: ['families'],
  collectionIds: [],
  personalization: { photo: true, avatar: true, memories: true, lessons: true },
  createdAt: now,
  updatedAt: now,
};

const style: IllustrationStyle = {
  slug: 'acuarela',
  active: true,
  order: 1,
  name: t('Acuarela'),
  promptModifier: 'soft watercolor',
  sampleImage: null,
  contentTypes: ['story', 'story_activities'],
  createdAt: now,
  updatedAt: now,
};

const lineArt: IllustrationStyle = {
  ...style,
  slug: 'para-colorear',
  order: 9,
  name: t('Para colorear'),
  promptModifier: 'coloring book line art',
  contentTypes: ['coloring'],
};

const lesson: Lesson = {
  slug: 'compartir',
  active: true,
  order: 1,
  group: 'values',
  ageMin: 2,
  ageMax: 10,
  name: t('Compartir'),
  headline: t('Compartir'),
  description: t('Compartir'),
  promptGuidance: 'Descubre que compartir multiplica la diversión.',
  sensitive: false,
  createdAt: now,
  updatedAt: now,
};

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

const UID = 'ana';
const TOKEN = `token-${UID}`;

async function seedBook(
  providers: ProviderRegistry,
  bookId: string,
  overrides: Record<string, unknown> = {},
) {
  const portrait = await sharp({
    create: { width: 256, height: 256, channels: 3, background: '#c9a27e' },
  })
    .jpeg()
    .toBuffer();
  const processedPath = `${UID}/${bookId}/photo-1/portrait.jpg`;
  await providers
    .storage()
    .upload({ bucket: 'photos', path: processedPath }, new Uint8Array(portrait), 'image/jpeg');
  await db.doc(`photos/${bookId}-photo`).set({
    ownerUid: UID,
    bookId,
    childId: `${bookId}-child`,
    status: 'valid',
    processedPath,
  });
  await db.doc(`children/${bookId}-child`).set({
    ownerUid: UID,
    name: 'Martina',
    age: 5,
    pronouns: 'she',
    likes: ['dinosaurios'],
    petName: null,
    bestFriendName: null,
  });
  await db.doc(`books/${bookId}`).set({
    ownerUid: UID,
    status: 'draft',
    childId: `${bookId}-child`,
    storyId: 'aventura-espacial',
    styleId: 'acuarela',
    lessonIds: ['compartir'],
    customLesson: null,
    language: 'es',
    dedication: null,
    wizardStep: 5,
    photoIds: [`${bookId}-photo`],
    preview: null,
    regenerationsUsed: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

async function setAiConfig(values: Record<string, unknown>) {
  await db.doc('aiConfig/global').set(
    {
      textProvider: 'mock',
      textModel: 'mock-text',
      imageProvider: 'mock',
      imageModel: 'mock-image',
      maxRegenerationsPerBook: 1,
      maxPreviewsPerUserPerDay: 5,
      dailyBudgetUsd: 5,
      budgetAlertPercent: 80,
      updatedAt: now,
      updatedBy: 'test',
      ...values,
    },
    { merge: false },
  );
}

describe('vista previa', () => {
  let app: App;
  let providers: ProviderRegistry;

  beforeAll(async () => {
    const created = await createTestApp({
      catalog: new InMemoryCatalog({
        stories: [story],
        styles: [style, lineArt],
        lessons: [lesson],
      }),
    });
    app = created.app;
    providers = created.providers;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of [
      'photos',
      'books',
      'children',
      'aiUsage',
      'aiBudget',
      'aiConfig',
      'previewQuota',
      'auditLog',
    ]) {
      const docs = await db.collection(name).listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }
    await setAiConfig({});
  });

  const generate = (bookId: string, token = TOKEN) =>
    app.inject({ method: 'POST', url: `/v1/books/${bookId}/preview`, headers: auth(token) });
  const approve = (bookId: string, token = TOKEN) =>
    app.inject({
      method: 'POST',
      url: `/v1/books/${bookId}/preview/character/approve`,
      headers: auth(token),
    });
  /** Muestra completa: etapa 1 (texto + personaje) y aprobación (portada + páginas). */
  const generateAndApprove = async (bookId: string) => {
    await generate(bookId);
    return approve(bookId);
  };

  it('etapa 1: texto completo y lámina del personaje, sin portada ni páginas ilustradas', async () => {
    await seedBook(providers, 'book-1');
    const res = await generate('book-1');
    expect(res.statusCode).toBe(200);
    const body = res.json<PublicPreview>();
    expect(body.status).toBe('preview_ready');
    expect(body.preview?.stage).toBe('character');
    expect(body.preview?.coverUrl).toBeNull();
    expect(body.preview?.character?.imageUrl).toContain('-preview.webp');
    expect(body.preview?.character?.approved).toBe(false);
    // Recién generada, la muestra no está desactualizada (los rasgos aún no están confirmados).
    expect(body.preview?.stale).toBe(false);
    // El visor recibe todas las páginas del cuento, todavía sin ilustrar.
    expect(body.preview?.pages).toHaveLength(4);
    expect(body.preview?.pages.every((page) => page.imageUrl === null)).toBe(true);
    // Rasgos estimados de la foto, con pelo y piel fijados por defecto.
    expect(body.preview?.character?.mustKeep).toEqual(['hair', 'skinTone']);

    // La enseñanza llega a la historia (el mock la nombra en la página 2).
    expect(body.preview?.pages[1]?.text).toContain('Compartir');

    // La ficha y los rasgos quedan guardados en la foto (se borran con ella).
    const photo = await db.doc('photos/book-1-photo').get();
    expect(photo.get('characterSheet.hair')).toBeTruthy();
    expect(photo.get('characterTraits.hairType')).toBeTruthy();

    // Solo 1 imagen en esta etapa.
    const usage = await db.collection('aiUsage').where('bookId', '==', 'book-1').get();
    expect(usage.docs.filter((doc) => doc.get('kind') === 'illustration')).toHaveLength(1);
  });

  it('la lámina va en 1K; la portada y las páginas aprobadas, en 2K (pueden ir a imprenta)', async () => {
    await seedBook(providers, 'book-1');
    const paint = vi.spyOn(providers.ai().image, 'generateIllustration');
    await generate('book-1');
    expect(paint.mock.calls.map(([request]) => request.resolution ?? '1K')).toEqual(['1K']);
    await approve('book-1');
    expect(paint.mock.calls.slice(1).map(([request]) => request.resolution)).toEqual([
      '2K',
      '2K',
      '2K',
    ]);
    paint.mockRestore();
  });

  it('aprobar al personaje ilustra la portada y 2 páginas con marca de agua, y registra el uso', async () => {
    await seedBook(providers, 'book-1');
    await generate('book-1');
    const res = await approve('book-1');
    expect(res.statusCode).toBe(200);
    const body = res.json<PublicPreview>();
    expect(body.preview?.stage).toBe('complete');
    expect(body.preview?.coverUrl).toContain('-preview.webp');
    expect(body.preview?.character?.approved).toBe(true);
    expect(body.preview?.pages.filter((page) => page.imageUrl)).toHaveLength(2);
    expect(body.preview?.stale).toBe(false);
    // Volver a aprobar no ilustra de nuevo.
    expect((await approve('book-1')).statusCode).toBe(409);

    const usage = await db.collection('aiUsage').where('bookId', '==', 'book-1').get();
    const kinds = new Set(usage.docs.map((doc) => doc.get('kind') as string));
    expect([...kinds].sort()).toEqual([
      'character',
      'illustration',
      'moderation',
      'review',
      'story',
    ]);
    expect((await db.doc(`aiBudget/${utcDay()}`).get()).get('calls')).toBe(usage.size);

    // Las versiones limpias existen pero el cliente solo recibe las de marca de agua.
    const book = await db.doc('books/book-1').get();
    const cleanPath = book.get('preview.cover.imagePath') as string;
    expect(await providers.storage().exists({ bucket: 'assets', path: cleanPath })).toBe(true);
    expect(JSON.stringify(body)).not.toContain(cleanPath);
    // Los rasgos aprobados quedan en el libro y hay un registro de calidad sin datos del niño.
    expect(book.get('characterTraits.hairType')).toBeTruthy();
    const qa = await db.collection('books/book-1/qaEvents').get();
    expect(qa.docs.map((doc) => doc.get('code') as string)).toContain('character_approved');
  });

  it('no aprueba una muestra desactualizada (los rasgos no se confirman para otra foto)', async () => {
    await seedBook(providers, 'book-1');
    await generate('book-1');
    await db.doc('books/book-1').update({ styleId: 'otro-estilo' });
    expect((await approve('book-1')).statusCode).toBe(409);
    expect((await db.doc('books/book-1').get()).get('characterTraits')).toBeUndefined();
  });

  it('con una sesión anónima, ilustrar pide cuenta (si así está configurado)', async () => {
    await seedBook(providers, 'book-1');
    await generate('book-1', `${TOKEN}:anonymous`);
    const blocked = await approve('book-1', `${TOKEN}:anonymous`);
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json<{ error: { code: string } }>().error.code).toBe('account_required');
    await setAiConfig({ illustrationsRequireAccount: false });
    expect((await approve('book-1', `${TOKEN}:anonymous`)).statusCode).toBe(200);
  });

  it('corregir rasgos vuelve a dibujar la lámina, cuenta como regeneración y queda en el libro', async () => {
    await seedBook(providers, 'book-1');
    const first = (await generate('book-1')).json<PublicPreview>();
    const traits = { ...first.preview?.character?.traits, glasses: true, distinctive: 'pecas' };
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/books/book-1/preview/character',
      headers: auth(TOKEN),
      payload: { traits, mustKeep: ['glasses', 'hair'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<PublicPreview>();
    expect(body.preview?.stage).toBe('character');
    expect(body.preview?.character?.imageUrl).not.toBe(first.preview?.character?.imageUrl);
    expect(body.preview?.character?.traits.glasses).toBe(true);
    expect(body.preview?.character?.mustKeep).toEqual(['glasses', 'hair']);
    expect(body.regenerationsLeft).toBe(0);
    expect(body.preview?.stale).toBe(false);
    expect((await db.doc('books/book-1').get()).get('mustKeep')).toEqual(['glasses', 'hair']);

    // Un rasgo distintivo no apto se rechaza.
    const unsafe = await app.inject({
      method: 'PUT',
      url: '/v1/books/book-1/preview/character',
      headers: auth(TOKEN),
      payload: { traits: { ...traits, distinctive: MOCK_UNSAFE_MARKER }, mustKeep: [] },
    });
    expect(unsafe.statusCode).toBe(422);
    // Aprobar después de corregir funciona.
    expect((await approve('book-1')).statusCode).toBe(200);
  });

  it('la extensión y la cantidad de texto son independientes (28 páginas, visual o más lectura)', async () => {
    await seedBook(providers, 'book-visual', { length: 'classic', textDensity: 'visual' });
    await seedBook(providers, 'book-rich', { length: 'classic', textDensity: 'rich' });
    const visual = (await generateAndApprove('book-visual')).json<PublicPreview>();
    const rich = (await generateAndApprove('book-rich')).json<PublicPreview>();
    expect(visual.preview?.totalPages).toBe(28);
    expect(rich.preview?.totalPages).toBe(28);
    const words = (text: string) => countWords(text);
    for (const page of visual.preview?.pages ?? []) {
      expect(words(page.text)).toBeGreaterThanOrEqual(5);
      expect(words(page.text)).toBeLessThanOrEqual(20);
    }
    for (const page of rich.preview?.pages ?? []) {
      expect(words(page.text)).toBeGreaterThanOrEqual(70);
      expect(words(page.text)).toBeLessThanOrEqual(120);
    }
    // El cuento completo tiene las páginas narrativas de la extensión (28 - 2 fijas).
    const book = await db.doc('books/book-rich').get();
    expect((book.get('preview.pages') as unknown[]).length).toBe(26);
  });

  it('un libro anterior (sin extensión) conserva las páginas de su historia', async () => {
    await seedBook(providers, 'book-1');
    const res = (await generate('book-1')).json<PublicPreview>();
    expect(res.preview?.totalPages).toBe(story.pageCount);
  });

  it('un libro para colorear usa el estilo de contornos aunque el borrador tenga otro', async () => {
    await seedBook(providers, 'book-1', { length: 'mini', contentType: 'coloring' });
    expect((await generate('book-1')).statusCode).toBe(200);
    expect((await db.doc('books/book-1').get()).get('preview.styleId')).toBe('para-colorear');
  });

  it('cambiar la densidad o el nivel deja la muestra desactualizada', async () => {
    await seedBook(providers, 'book-1', { length: 'short', textDensity: 'balanced' });
    await generate('book-1');
    await db.doc('books/book-1').update({ readingLevel: 'advanced' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/book-1/preview',
      headers: auth(TOKEN),
    });
    expect(res.json<PublicPreview>().preview?.stale).toBe(true);
  });

  it('otra persona no puede ver ni generar la vista previa', async () => {
    await seedBook(providers, 'book-1');
    expect((await generate('book-1', 'token-otro')).statusCode).toBe(404);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/book-1/preview',
      headers: auth('token-otro'),
    });
    expect(res.statusCode).toBe(404);
  });

  it('respeta la cuota diaria de vistas previas por usuario', async () => {
    await setAiConfig({ maxPreviewsPerUserPerDay: 1 });
    await seedBook(providers, 'book-1');
    await seedBook(providers, 'book-2');
    expect((await generate('book-1')).statusCode).toBe(200);
    const second = await generate('book-2');
    expect(second.statusCode).toBe(429);
    expect(second.json<{ error: { code: string } }>().error.code).toBe('limit_reached');
  });

  it('corta cuando se agotó el presupuesto diario, sin tocar el borrador', async () => {
    await setAiConfig({ dailyBudgetUsd: 1 });
    await db.doc(`aiBudget/${utcDay()}`).set({ spentUsdMicros: 1_000_000, calls: 10 });
    await seedBook(providers, 'book-1');
    const res = await generate('book-1');
    expect(res.statusCode).toBe(503);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('ai_unavailable');
    expect((await db.doc('books/book-1').get()).get('status')).toBe('draft');
  });

  it('si el mensaje propio no es apto, informa y vuelve a borrador', async () => {
    await seedBook(providers, 'book-1', { customLesson: `Hola ${MOCK_UNSAFE_MARKER}` });
    const res = await generate('book-1');
    expect(res.statusCode).toBe(422);
    const book = (await db.doc('books/book-1').get()).data();
    expect(book?.status).toBe('draft');
    expect(book?.previewError).toMatch(/mensaje propio/);
  });

  it('modo sin foto: genera con los rasgos elegidos, sin foto ni ficha por IA', async () => {
    const avatar = {
      skinTone: 'brown',
      hairColor: 'dark-brown',
      hairLength: 'medium',
      hairType: 'curly',
      eyeColor: 'hazel',
      glasses: true,
    };
    await seedBook(providers, 'book-1', { characterMode: 'avatar', avatar, photoIds: [] });
    expect((await generate('book-1')).json<PublicPreview>().preview?.stale).toBe(false);
    const res = await approve('book-1');
    expect(res.statusCode).toBe(200);
    expect(res.json<PublicPreview>().preview?.pages.filter((page) => page.imageUrl)).toHaveLength(
      2,
    );
    // Sin foto, los rasgos elegidos son los del personaje (y los anteojos quedan fijados).
    expect(res.json<PublicPreview>().preview?.character?.mustKeep).toContain('glasses');
    const usage = await db.collection('aiUsage').where('bookId', '==', 'book-1').get();
    expect(usage.docs.some((doc) => doc.get('kind') === 'character')).toBe(false);

    // Cambiar un rasgo deja la muestra desactualizada.
    await db.doc('books/book-1').update({ avatar: { ...avatar, glasses: false } });
    const after = await app.inject({
      method: 'GET',
      url: '/v1/books/book-1/preview',
      headers: auth(TOKEN),
    });
    expect(after.json<PublicPreview>().preview?.stale).toBe(true);

    // Los rasgos aprobados eran para los rasgos anteriores: la nueva muestra usa los nuevos.
    const again = (await generate('book-1')).json<PublicPreview>();
    expect(again.preview?.character?.traits.glasses).toBe(false);
    expect(again.preview?.character?.mustKeep).not.toContain('glasses');
    expect(again.preview?.stale).toBe(false);
  });

  it('modo sin foto sin rasgos elegidos: pide completarlos', async () => {
    await seedBook(providers, 'book-1', { characterMode: 'avatar', avatar: null, photoIds: [] });
    expect((await generate('book-1')).statusCode).toBe(409);
  });

  it('modera los recuerdos antes de usarlos', async () => {
    await seedBook(providers, 'book-1', {
      memories: {
        moment: null,
        companion: 'Su abuela Rosa',
        nickname: `Tini ${MOCK_UNSAFE_MARKER}`,
        favorite: null,
      },
    });
    const res = await generate('book-1');
    expect(res.statusCode).toBe(422);
    expect((await db.doc('books/book-1').get()).get('previewError')).toMatch(/recuerdos/);
  });

  it('pide completar el borrador antes de generar', async () => {
    await seedBook(providers, 'book-1', { styleId: null });
    expect((await generate('book-1')).statusCode).toBe(409);
  });

  it('regenera una ilustración hasta el límite y descuenta solo si sale bien', async () => {
    await seedBook(providers, 'book-1');
    const first = (await generateAndApprove('book-1')).json<PublicPreview>();
    const regenerate = (target: string) =>
      app.inject({
        method: 'POST',
        url: `/v1/books/book-1/preview/illustrations/${target}/regenerate`,
        headers: auth(TOKEN),
      });

    expect((await regenerate('5')).statusCode).toBe(404);
    const ok = await regenerate('0');
    expect(ok.statusCode).toBe(200);
    const after = ok.json<PublicPreview>();
    expect(after.regenerationsLeft).toBe(0);
    expect(after.preview?.pages[0]?.imageUrl).not.toBe(first.preview?.pages[0]?.imageUrl);

    const limited = await regenerate('cover');
    expect(limited.statusCode).toBe(429);
    expect((await db.doc('books/book-1').get()).get('regenerationsUsed')).toBe(1);
  });

  it('edita el texto de una página y modera lo que escribe el adulto', async () => {
    await seedBook(providers, 'book-1');
    await generate('book-1');
    const edit = (text: string) =>
      app.inject({
        method: 'PATCH',
        url: '/v1/books/book-1/preview/pages/1',
        headers: auth(TOKEN),
        payload: { text },
      });
    const ok = await edit('Martina saluda a la Luna con su perro Rocco.');
    expect(ok.statusCode).toBe(200);
    expect(ok.json<PublicPreview>().preview?.pages[1]?.text).toBe(
      'Martina saluda a la Luna con su perro Rocco.',
    );
    expect((await edit(`Texto ${MOCK_UNSAFE_MARKER}`)).statusCode).toBe(422);
  });

  it('marca la vista previa como desactualizada si cambia el estilo', async () => {
    await seedBook(providers, 'book-1');
    await generate('book-1');
    await db.doc('books/book-1').update({ styleId: 'cartoon-3d' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/book-1/preview',
      headers: auth(TOKEN),
    });
    expect(res.json<PublicPreview>().preview?.stale).toBe(true);
  });
});

describe('configuración de IA', () => {
  let app: App;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of ['aiConfig', 'auditLog']) {
      const docs = await db.collection(name).listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }
    await setAiConfig({});
  });

  const patch = (token: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'PATCH', url: '/v1/admin/ai-config', headers: auth(token), payload });

  it('los admins la ven; solo el superadmin la cambia, y queda en auditoría', async () => {
    const view = await app.inject({
      method: 'GET',
      url: '/v1/admin/ai-config',
      headers: auth('token-admin:admin'),
    });
    expect(view.statusCode).toBe(200);
    expect(view.json<{ available: { text: string[] } }>().available.text).toContain('mock');

    expect((await patch('token-ana', { dailyBudgetUsd: 2 })).statusCode).toBe(403);
    expect((await patch('token-admin:admin', { dailyBudgetUsd: 2 })).statusCode).toBe(403);

    const ok = await patch('token-root:superadmin', { dailyBudgetUsd: 2 });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<{ config: { dailyBudgetUsd: number } }>().config.dailyBudgetUsd).toBe(2);
    const audit = await db.collection('auditLog').where('action', '==', 'ai_config.update').get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0]?.get('before.dailyBudgetUsd')).toBe(5);
  });

  it('rechaza proveedores no disponibles en el ambiente', async () => {
    // Sin proyecto de Google Cloud (tests y local) Vertex no se registra.
    const res = await patch('token-root:superadmin', {
      textProvider: 'vertex',
      textModel: 'gemini-3.5-flash',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('checkout y pagos (fase 11)', () => {
  let app: App;
  let providers: ProviderRegistry;
  let events: RecordingPublisher;
  let conversions: RecordingConversions;
  let notifier: EmailNotifier;

  const mexico: CountryConfig = {
    code: 'MX',
    active: true,
    formats: { digital: true, softcover: true, hardcover: true },
    currency: 'MXN',
    defaultLocale: 'es',
    taxBasisPoints: 1600,
    taxIncludedInPrice: true,
    shipping: { costMinor: 14900, etaDaysMin: 5, etaDaysMax: 9 },
    updatedAt: now,
  };
  const price = (format: Price['format'], amountMinor: number): Price => ({
    country: 'MX',
    format,
    currency: 'MXN',
    amountMinor,
    // Precio Pro base: 10 % menos (cuentas profesionales).
    proAmountMinor: Math.round(amountMinor * 0.9),
    lengthAdjustmentsMinor: {},
    active: true,
    updatedAt: now,
  });
  const ADDRESS = {
    name: 'Ana Pérez',
    line1: 'Av. Reforma 123',
    line2: null,
    city: 'Ciudad de México',
    state: 'CDMX',
    postalCode: '06600',
    country: 'MX',
    phone: '+52 55 1234 5678',
  };

  beforeAll(async () => {
    events = new RecordingPublisher();
    conversions = new RecordingConversions();
    const created = await createTestApp(
      {
        catalog: new InMemoryCatalog({
          stories: [story],
          styles: [style, lineArt],
          lessons: [lesson],
          countries: [mexico],
          prices: [price('digital', 34900), price('hardcover', 89900)],
          printOptions: [
            {
              country: 'MX',
              format: 'hardcover',
              provider: 'mock',
              sku: 'photobook-hardcover-210x280',
              enabled: true,
              qaSamplePassed: true,
              pages: { min: 4, max: 120, multipleOf: 2 },
              maxQuantity: 50,
              etaDaysMin: 6,
              etaDaysMax: 10,
              productionCostUsdMinor: 1400,
              updatedAt: now,
            },
            {
              country: 'MX',
              format: 'hardcover',
              provider: 'mock_alt',
              sku: 'photobook-hardcover-210x280',
              enabled: true,
              qaSamplePassed: true,
              pages: { min: 4, max: 120, multipleOf: 2 },
              maxQuantity: 50,
              etaDaysMin: 5,
              etaDaysMax: 9,
              productionCostUsdMinor: 1550,
              updatedAt: now,
            },
          ],
          eventPricing: [
            {
              country: 'MX',
              currency: 'MXN',
              active: true,
              designMinor: 24900,
              pieces: { invitation: 6900, stickers: 5900 },
              updatedAt: now,
            },
          ],
        }),
        pipelineEvents: events,
        conversions,
      },
      // Dos imprentas simuladas: se cotiza con las dos y gana la más barata.
      { PRINT_PROVIDERS: 'mock,mock_alt' },
    );
    app = created.app;
    providers = created.providers;
    notifier = created.deps.notifier;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    events.events.length = 0;
    conversions.purchases.length = 0;
    for (const name of [
      'photos',
      'books',
      'children',
      'orders',
      'coupons',
      'promotions',
      'paymentEvents',
      'adminAlerts',
      'auditLog',
      'aiUsage',
      'aiBudget',
      'previewQuota',
      'emailLog',
      'reviews',
      'users',
      'printQuoteRequests',
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
    await setAiConfig({});
  });

  /** Libro con la muestra completa y el personaje aprobado. */
  async function approvedBook(bookId = 'book-1') {
    await seedBook(providers, bookId);
    await app.inject({ method: 'POST', url: `/v1/books/${bookId}/preview`, headers: auth(TOKEN) });
    await app.inject({
      method: 'POST',
      url: `/v1/books/${bookId}/preview/character/approve`,
      headers: auth(TOKEN),
    });
  }

  const post = (url: string, payload: unknown, token = TOKEN) =>
    app.inject({ method: 'POST', url, headers: auth(token), payload: payload as object });
  const webhook = (
    payload: Parameters<typeof signMockPaymentWebhook>[1],
    secret = 'test-webhook-secret',
  ) => {
    const signed = signMockPaymentWebhook(secret, payload);
    return app.inject({
      method: 'POST',
      url: '/v1/webhooks/payments/mock',
      headers: { 'content-type': 'application/json', ...signed.headers },
      payload: signed.rawBody,
    });
  };
  const checkout = async (body: Record<string, unknown> = {}) => {
    const res = await post('/v1/checkout', {
      bookId: 'book-1',
      format: 'digital',
      country: 'MX',
      analyticsConsent: true,
      ...body,
    });
    return res;
  };
  const completed = (orderId: string, amountMinor: number, id = 'evt_1') => ({
    id,
    type: 'checkout.completed',
    data: { orderId, sessionId: 'cs_1', paymentId: 'pay_1', amountMinor, currency: 'MXN' },
  });

  it('cotiza en el servidor: envío, IVA incluido y cupón (o su error)', async () => {
    await approvedBook();
    await db.doc('coupons/BIENVENIDA').set({
      code: 'BIENVENIDA',
      type: 'percent',
      value: 10,
      currency: null,
      countries: [],
      validFrom: new Date('2026-01-01'),
      validUntil: null,
      maxRedemptions: null,
      redemptions: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const res = await post('/v1/checkout/quote', {
      bookId: 'book-1',
      format: 'hardcover',
      country: 'MX',
      couponCode: 'bienvenida',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ snapshot: PriceSnapshot; couponError: string | null }>();
    expect(body.couponError).toBeNull();
    expect(body.snapshot.discount).toEqual({ minor: 8990, reason: 'coupon', label: 'BIENVENIDA' });
    expect(body.snapshot.totalMinor).toBe(89900 - 8990 + 14900);

    const bad = await post('/v1/checkout/quote', {
      bookId: 'book-1',
      format: 'digital',
      country: 'MX',
      couponCode: 'NOEXISTE',
    });
    expect(bad.json<{ couponError: string }>().couponError).toBe('coupon_invalid');
  });

  it('Profesionales: solo la API activa la cuenta; precio Pro y escalón por compras elegibles', async () => {
    await approvedBook();
    const quoteDigital = async (extra: Record<string, unknown> = {}) => {
      const res = await post('/v1/checkout/quote', {
        bookId: 'book-1',
        format: 'digital',
        country: 'MX',
        ...extra,
      });
      return res.json<{ snapshot: PriceSnapshot }>().snapshot;
    };
    const status = async () =>
      (await app.inject({ method: 'GET', url: '/v1/me/professional', headers: auth(TOKEN) })).json<{
        accountType: string;
        discount: { purchases: number; next: unknown } | null;
      }>();

    // Familia: aunque la petición diga que es Pro, paga el precio de Familias.
    const family = await quoteDigital({ pro: { purchases: 50 }, accountType: 'professional' });
    expect(family.subtotalMinor).toBe(34900);
    expect(family.discount.reason).toBeNull();
    expect((await status()).accountType).toBe('family');

    const activated = await post('/v1/me/professional', {
      profession: 'teacher',
      professionOther: 'no se guarda',
      practiceName: 'Escuela Arcoíris',
      country: 'MX',
    });
    expect(activated.statusCode).toBe(200);
    expect((await db.doc(`users/${UID}`).get()).get('proProfile')).toMatchObject({
      profession: 'teacher',
      professionOther: null,
    });
    expect(await status()).toMatchObject({
      accountType: 'professional',
      discount: { purchases: 0, next: { purchases: 5, percent: 10 } },
    });
    // Precio Pro base (10 % menos), sin descuento por recurrencia todavía.
    expect((await quoteDigital()).subtotalMinor).toBe(31410);

    // 5 compras elegibles en 90 días → 10 %. No cuentan: reembolsadas, canceladas, pendientes,
    // las de otra cuenta ni las anteriores a la ventana.
    const day = 24 * 3600 * 1000;
    const orders: [string, string, number, string][] = [
      ['o1', 'paid', 1, UID],
      ['o2', 'delivered', 10, UID],
      ['o3', 'shipped', 20, UID],
      ['o4', 'ready', 30, UID],
      ['o5', 'qa_failed', 40, UID],
      ['o6', 'refunded', 5, UID],
      ['o7', 'cancelled', 5, UID],
      ['o8', 'pending_payment', 5, UID],
      ['o9', 'paid', 100, UID],
      ['o10', 'paid', 5, 'otra-cuenta'],
    ];
    for (const [id, orderStatus, daysAgo, ownerUid] of orders) {
      await db
        .doc(`orders/${id}`)
        .set({ ownerUid, status: orderStatus, createdAt: new Date(Date.now() - daysAgo * day) });
    }
    expect((await status()).discount?.purchases).toBe(5);
    const tier = await quoteDigital();
    expect(tier.discount).toEqual({ minor: 3141, reason: 'pro', label: 'Pro 10 %' });
    expect(tier.totalMinor).toBe(31410 - 3141);

    // Un reembolso posterior baja el escalón para las compras siguientes.
    await db.doc('orders/o2').update({ status: 'refunded' });
    expect((await status()).discount?.purchases).toBe(4);
    expect((await quoteDigital()).discount.reason).toBeNull();
  });

  it('sin muestra aprobada, sin cuenta o sin dirección válida no se puede pagar', async () => {
    await seedBook(providers, 'book-1');
    expect((await checkout()).statusCode).toBe(409);
    await approvedBook('book-2');
    expect((await checkout({ bookId: 'book-2', format: 'hardcover' })).statusCode).toBe(400);
    const badZip = await checkout({
      bookId: 'book-2',
      format: 'hardcover',
      shippingAddress: { ...ADDRESS, postalCode: '123' },
    });
    expect(badZip.statusCode).toBe(400);
    expect(badZip.json<{ error: { code: string } }>().error.code).toBe('validation_failed');
    expect(badZip.json<{ error: { message: string } }>().error.message).toContain('postalCode');
    const anonymous = await post(
      '/v1/checkout',
      { bookId: 'book-2', format: 'digital', country: 'MX' },
      `${TOKEN}:anonymous`,
    );
    expect(anonymous.json<{ error: { code: string } }>().error.code).toBe('account_required');
  });

  it('si la imprenta más barata no responde, gana la siguiente; si ninguna, solo digital', async () => {
    await approvedBook();
    const quote = (id: string) => {
      const printer = providers.printer(id);
      if (!printer) throw new Error(`Imprenta ${id} inactiva`);
      return vi.spyOn(printer, 'quote');
    };
    quote('mock').mockRejectedValue(new Error('503'));
    const res = await checkout({ format: 'hardcover', shippingAddress: ADDRESS });
    expect(res.statusCode).toBe(200);
    const { orderId } = res.json<{ orderId: string }>();
    const routing = (await db.doc(`orders/${orderId}`).get()).get('printRouting') as {
      provider: string;
      quotes: { provider: string; error: string | null }[];
    };
    expect(routing.provider).toBe('mock_alt');
    expect(routing.quotes.find((quoted) => quoted.provider === 'mock')?.error).toBe('503');

    quote('mock_alt').mockRejectedValue(new Error('timeout'));
    const none = await checkout({ format: 'hardcover', shippingAddress: ADDRESS });
    expect(none.json<{ error: { code: string } }>().error.code).toBe('print_unavailable');
    vi.restoreAllMocks();
  });

  it('pago confirmado por el webhook: pedido pagado, pipeline en marcha y libro cerrado', async () => {
    await approvedBook();
    const res = await checkout({ format: 'hardcover', shippingAddress: ADDRESS });
    expect(res.statusCode).toBe(200);
    const { orderId, checkoutUrl } = res.json<{ orderId: string; checkoutUrl: string }>();
    expect(checkoutUrl).toContain(`/es/pedido/${orderId}`);
    const stored = (await db.doc(`orders/${orderId}`).get()).data() as
      | { status: string; approval: { fingerprint: string }; priceSnapshot: PriceSnapshot }
      | undefined;
    expect(stored?.status).toBe('pending_payment');
    expect(stored?.approval.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.priceSnapshot.totalMinor).toBe(104800);
    // A México la imprenta simulada principal sale más barata (mismo envío, menos impresión).
    const routing = (await db.doc(`orders/${orderId}`).get()).get('printRouting') as {
      provider: string;
      quotes: { provider: string; totalCostUsdMinor: number; error: null }[];
    };
    expect(routing.provider).toBe('mock');
    expect(routing.quotes.map((quoted) => [quoted.provider, quoted.totalCostUsdMinor])).toEqual([
      ['mock', 1950],
      ['mock_alt', 2100],
    ]);

    // Firma inválida: se rechaza y no cambia nada.
    expect((await webhook(completed(orderId, 104800), 'otro-secreto')).statusCode).toBe(400);
    expect((await db.doc(`orders/${orderId}`).get()).get('status')).toBe('pending_payment');

    const ok = await webhook(completed(orderId, 104800));
    expect(ok.json<{ outcome: string }>().outcome).toBe('processed');
    // El mismo evento otra vez no duplica nada.
    const again = await webhook(completed(orderId, 104800));
    expect(again.json<{ outcome: string }>().outcome).toBe('duplicate');

    expect((await db.doc(`orders/${orderId}`).get()).get('status')).toBe('paid');
    expect((await db.doc('books/book-1').get()).get('status')).toBe('ordered');
    expect(events.events).toEqual([
      { type: 'order.paid', orderId, requestId: `paid:${orderId}:pay_1` },
    ]);
    expect(conversions.purchases).toEqual([{ orderId, valueMinor: 104800, currency: 'MXN' }]);
  });

  it('si lo cobrado no coincide con lo congelado, no se fabrica y se avisa al admin', async () => {
    await approvedBook();
    const { orderId } = (await checkout()).json<{ orderId: string }>();
    await webhook(completed(orderId, 100));
    expect((await db.doc(`orders/${orderId}`).get()).get('status')).toBe('pending_payment');
    expect(events.events).toEqual([]);
    const alerts = await db.collection('adminAlerts').get();
    expect(alerts.docs.map((doc) => doc.get('kind') as unknown)).toEqual(['payment_mismatch']);
  });

  it('checkout vencido → cancelado; reembolso desde el admin → reembolsado y auditado', async () => {
    await approvedBook();
    const first = (await checkout()).json<{ orderId: string }>().orderId;
    await webhook({
      id: 'evt_exp',
      type: 'checkout.expired',
      data: { orderId: first, sessionId: 'cs_1' },
    });
    expect((await db.doc(`orders/${first}`).get()).get('status')).toBe('cancelled');

    const second = (await checkout()).json<{ orderId: string }>().orderId;
    await webhook(completed(second, 34900, 'evt_2'));
    const refund = await post(
      `/v1/admin/orders/${second}/refund`,
      { reason: 'No le gustó' },
      'token-admin:admin',
    );
    expect(refund.statusCode).toBe(200);
    expect(refund.json<{ status: string }>().status).toBe('refunded');
    const audit = await db.collection('auditLog').where('action', '==', 'order.refund').get();
    expect(audit.size).toBe(1);
    const twice = await post(
      `/v1/admin/orders/${second}/refund`,
      { reason: 'Otra vez' },
      'token-admin:admin',
    );
    expect(twice.statusCode).toBe(409);
  });

  it('recompra con un clic: mismo libro, sin muestra nueva; un digital no pasa a impreso', async () => {
    await approvedBook();
    const { orderId } = (await checkout()).json<{ orderId: string }>();
    await webhook(completed(orderId, 34900, 'evt_src'));
    // El libro ya se generó (lo haría el worker).
    await db.doc(`orders/${orderId}`).update({
      status: 'ready',
      snapshot: { title: 'La aventura de Martina', hash: 'h' },
      snapshotHash: 'h',
    });
    await db.doc(`orders/${orderId}/steps/layout_pdf`).set({
      output: { files: [{ format: 'digital', kind: 'book', pages: 20 }] },
    });

    // La cotización de la recompra no pide una vista previa vigente.
    await db.doc(`books/book-1`).update({ status: 'ordered' });
    const quoted = await post('/v1/checkout/quote', {
      bookId: 'book-1',
      format: 'digital',
      country: 'MX',
      sourceOrderId: orderId,
    });
    expect(quoted.statusCode).toBe(200);
    expect(quoted.json<{ snapshot: { totalMinor: number } }>().snapshot.totalMinor).toBeGreaterThan(
      0,
    );

    const toPrint = await post(`/v1/orders/${orderId}/reorder`, {
      format: 'hardcover',
      country: 'MX',
      shippingAddress: ADDRESS,
    });
    expect(toPrint.json<{ error: { code: string } }>().error.code).toBe('print_unavailable');

    const again = await post(`/v1/orders/${orderId}/reorder`, {
      format: 'digital',
      country: 'MX',
      gift: { isGift: true, message: 'Para la prima' },
    });
    expect(again.statusCode).toBe(200);
    const created = (
      await db.doc(`orders/${again.json<{ orderId: string }>().orderId}`).get()
    ).data() as
      | { sourceOrderId: string; status: string; snapshot: { title: string }; bookTitle: string }
      | undefined;
    expect(created?.sourceOrderId).toBe(orderId);
    expect(created?.status).toBe('pending_payment');
    expect(created?.snapshot.title).toBe('La aventura de Martina');
    expect(created?.bookTitle).toBe('La aventura de Martina');

    const notMine = await post(
      `/v1/orders/${orderId}/reorder`,
      { format: 'digital', country: 'MX' },
      'token-luis',
    );
    expect(notMine.statusCode).toBe(404);
  });

  /** Mails que mandó el proveedor simulado (filtrados por su clave). */
  const mails = (filter: (message: EmailMessage) => boolean) =>
    (providers.email() as MockEmailProvider).sent.filter(filter);

  it('mails del pedido: en el idioma del cliente y una sola vez por estado', async () => {
    await db
      .doc(`users/${UID}`)
      .set({ email: `${UID}@storynido.test`, locale: 'en', marketingOptIn: false });
    await approvedBook();
    const { orderId } = (await checkout({ format: 'hardcover', shippingAddress: ADDRESS })).json<{
      orderId: string;
    }>();
    // El webhook duplicado no repite el mail.
    await webhook(completed(orderId, 104800, 'evt_mail'));
    await webhook(completed(orderId, 104800, 'evt_mail_2'));
    const ofOrder = () =>
      mails((message) => message.idempotencyKey.startsWith(`order:${orderId}:`));
    expect(ofOrder().map((message) => message.template)).toEqual(['payment_confirmed']);
    expect(ofOrder()[0]).toMatchObject({
      to: `${UID}@storynido.test`,
      locale: 'en',
      data: { format: 'hardcover', total: expect.stringContaining('MXN') as string },
    });
    expect((await db.collection('emailLog').where('orderId', '==', orderId).get()).size).toBe(1);

    // La imprenta (simulada): en producción → despachado (con seguimiento) → entregado.
    await db.doc(`orders/${orderId}`).update({
      status: 'sent_to_print',
      print: {
        provider: 'mock',
        externalOrderId: 'mock_po_mail',
        trackingNumber: null,
        trackingUrl: null,
      },
    });
    for (let step = 0; step < 3; step += 1) {
      await post(`/v1/dev/orders/${orderId}/simulate-print`, {});
    }
    expect(ofOrder().map((message) => message.template)).toEqual([
      'payment_confirmed',
      'print_in_production',
      'shipped',
      'delivered',
    ]);
    const shipped = ofOrder().find((message) => message.template === 'shipped');
    expect(String(shipped?.data.trackingNumber)).toMatch(/^MOCK/);
    expect((await db.doc(`orders/${orderId}`).get()).get('deliveredAt')).toBeTruthy();
  });

  it('marketing: solo con consentimiento y con baja firmada que se respeta', async () => {
    const send = (key: string) =>
      notifier.notify({
        key,
        template: 'review_request',
        uid: UID,
        data: { bookTitle: 'La aventura', url: 'https://storynido.test/es/pedido/o1#opinion' },
      });
    await db
      .doc(`users/${UID}`)
      .set({ email: `${UID}@storynido.test`, locale: 'es', marketingOptIn: false });
    expect(await send('m1')).toBe('skipped');
    await db.doc(`users/${UID}`).update({ marketingOptIn: true });
    expect(await send('m2')).toBe('sent');
    expect(await send('m2')).toBe('duplicate');
    const sent = mails((message) => message.idempotencyKey === 'm2')[0];
    const link = new URL(String(sent?.data.unsubscribeUrl));
    expect(link.pathname).toBe('/v1/email/unsubscribe');

    const forged = await app.inject({
      method: 'GET',
      url: `/v1/email/unsubscribe?u=${UID}&t=nope`,
    });
    expect(forged.statusCode).toBe(400);
    const done = await app.inject({ method: 'GET', url: `/v1/email/unsubscribe${link.search}` });
    expect(done.statusCode).toBe(200);
    expect(done.body).toContain('No vas a recibir más correos de novedades');
    expect((await db.doc(`users/${UID}`).get()).get('marketingOptIn')).toBe(false);
    expect(await send('m3')).toBe('skipped');
    // Los avisos del pedido siguen llegando: no son marketing.
    expect(
      await notifier.notify({
        key: 'm4',
        template: 'delivered',
        uid: UID,
        data: { bookTitle: 'La aventura', url: 'https://storynido.test/es/pedido/o1' },
      }),
    ).toBe('sent');
  });

  it('bienvenida al iniciar sesión, una sola vez por cuenta', async () => {
    await db.doc(`users/${UID}`).set({
      email: `${UID}@storynido.test`,
      locale: 'pt',
      displayName: 'Ana',
      marketingOptIn: false,
    });
    for (let call = 0; call < 2; call += 1) {
      await app.inject({ method: 'GET', url: '/v1/me', headers: auth(TOKEN) });
    }
    await app.inject({ method: 'GET', url: '/v1/me', headers: auth('token-anon:anonymous') });
    const welcome = mails((message) => message.idempotencyKey.startsWith('welcome:'));
    expect(welcome).toHaveLength(1);
    expect(welcome[0]).toMatchObject({ locale: 'pt', data: { name: 'Ana' } });
  });

  it('opinión del cliente: recién con el libro recibido, privada y editable', async () => {
    await approvedBook();
    const { orderId } = (await checkout()).json<{ orderId: string }>();
    const review = (rating: number, comment: string | null) =>
      post(`/v1/orders/${orderId}/review`, { rating, comment });
    expect((await review(5, 'Hermoso')).statusCode).toBe(409);
    await db.doc(`orders/${orderId}`).update({ status: 'ready' });
    expect((await review(4, 'Muy lindo')).statusCode).toBe(200);
    expect((await review(5, '  Hermoso  ')).statusCode).toBe(200);
    const view = await app.inject({
      method: 'GET',
      url: `/v1/orders/${orderId}`,
      headers: auth(TOKEN),
    });
    expect(view.json<PublicOrder>()).toMatchObject({
      canReview: true,
      review: { rating: 5, comment: 'Hermoso' },
    });
    expect((await db.doc(`reviews/${orderId}`).get()).get('published')).toBe(false);
    const other = await post(`/v1/orders/${orderId}/review`, { rating: 1 }, 'token-luis');
    expect(other.statusCode).toBe(404);
  });

  it('kit de Eventos: diseño + licencia por pieza, una línea por pieza y solo para Eventos', async () => {
    await approvedBook();
    const kit = {
      pieces: [
        { piece: 'mini_book', copies: 30 },
        { piece: 'stickers', copies: 30 },
      ],
      invitation: { time: '16:00', place: 'Salón Arcoíris' },
    };
    const body = { bookId: 'book-1', format: 'digital', country: 'MX', kit };
    // Un libro de Familias no lleva kit.
    expect((await post('/v1/checkout/quote', body)).statusCode).toBe(400);
    await db.doc('books/book-1').update({ channel: 'events' });
    const quoted = await post('/v1/checkout/quote', body);
    expect(quoted.statusCode).toBe(200);
    const snapshot = quoted.json<{ snapshot: PriceSnapshot }>().snapshot;
    expect(
      snapshot.components.map((item) => [item.code, item.piece ?? null, item.totalMinor]),
    ).toEqual([
      ['design', null, 24900],
      ['piece', 'stickers', 5900],
    ]);
    expect(snapshot.totalMinor).toBe(30800);
    // Una pieza sin precio en el país no se vende; impreso, tampoco (se pide cotización).
    const tags = await post('/v1/checkout/quote', {
      ...body,
      kit: { ...kit, pieces: [...kit.pieces, { piece: 'favor_tags', copies: 30 }] },
    });
    expect(tags.statusCode).toBe(409);
    const printed = await post('/v1/checkout/quote', { ...body, format: 'hardcover' });
    expect(printed.json<{ error: { code: string } }>().error.code).toBe('print_unavailable');

    const res = await checkout({ kit });
    expect(res.statusCode).toBe(200);
    const order = (await db.doc(`orders/${res.json<{ orderId: string }>().orderId}`).get()).data();
    expect(order?.items).toEqual([
      { piece: 'mini_book', format: 'digital', quantity: 30 },
      { piece: 'stickers', format: 'digital', quantity: 30 },
    ]);
    expect(order?.kit).toMatchObject({ paper: 'a4', invitation: { place: 'Salón Arcoíris' } });
    expect((order?.priceSnapshot as PriceSnapshot).totalMinor).toBe(30800);
  });

  it('kit: "pedir más copias" cobra solo las licencias; los impresos se piden por cotización', async () => {
    await approvedBook();
    await db.doc('books/book-1').update({ channel: 'events' });
    const kit = {
      pieces: [
        { piece: 'mini_book', copies: 20 },
        { piece: 'invitation', copies: 20 },
      ],
      invitation: null,
    };
    const { orderId } = (await checkout({ kit })).json<{ orderId: string }>();
    await db.doc(`orders/${orderId}`).update({
      status: 'ready',
      snapshot: { title: 'El cumple de Martina', hash: 'h' },
    });
    const more = { ...kit, pieces: kit.pieces.map((item) => ({ ...item, copies: 40 })) };
    const quoted = await post('/v1/checkout/quote', {
      bookId: 'book-1',
      format: 'digital',
      country: 'MX',
      kit: more,
      sourceOrderId: orderId,
    });
    const snapshot = quoted.json<{ snapshot: PriceSnapshot }>().snapshot;
    expect(snapshot.components.map((item) => item.code)).toEqual(['piece']);
    expect(snapshot.totalMinor).toBe(6900);
    const again = await post(`/v1/orders/${orderId}/reorder`, {
      format: 'digital',
      country: 'MX',
      kit: more,
    });
    expect(again.statusCode).toBe(200);
    const copy = (await db.doc(`orders/${again.json<{ orderId: string }>().orderId}`).get()).data();
    expect(copy?.sourceOrderId).toBe(orderId);
    expect(copy?.items).toEqual([
      { piece: 'mini_book', format: 'digital', quantity: 40 },
      { piece: 'invitation', format: 'digital', quantity: 40 },
    ]);

    const request = await post('/v1/events/print-quote', {
      bookId: 'book-1',
      country: 'MX',
      pieces: ['mini_book', 'stickers'],
      copies: 30,
      message: 'Para el 5 de diciembre',
    });
    expect(request.statusCode).toBe(200);
    expect((await db.collection('printQuoteRequests').get()).size).toBe(1);
    const alerts = mails((message) => message.template === 'admin_alert');
    expect(alerts.at(-1)?.data.message).toContain('mini_book, stickers × 30 copias');
  });

  it('Profesionales: precio Pro y descuento por compras elegibles; Familia no los obtiene', async () => {
    await approvedBook();
    const quoted = async () =>
      (
        await post('/v1/checkout/quote', {
          bookId: 'book-1',
          format: 'hardcover',
          country: 'MX',
        })
      ).json<{ snapshot: PriceSnapshot }>().snapshot;
    // Familia: precio de siempre, aunque la petición traiga cosas raras.
    const family = await quoted();
    expect(family.components[0]?.unitMinor).toBe(89900);
    const status = () =>
      app.inject({ method: 'GET', url: '/v1/me/professional', headers: auth(TOKEN) });
    expect((await status()).json<{ accountType: string }>().accountType).toBe('family');

    const activated = await post('/v1/me/professional', {
      profession: 'psychopedagogue',
      professionOther: null,
      practiceName: 'Espacio Aprender',
      country: 'MX',
    });
    expect(activated.statusCode).toBe(200);
    expect((await quoted()).components[0]?.unitMinor).toBe(80910);

    // 5 compras elegibles en 90 días → 10 %. No cuentan: reembolsado, cancelado,
    // pendiente de pago ni una de hace 100 días.
    const day = 24 * 3600 * 1000;
    const seed = (id: string, status: string, daysAgo: number) =>
      db.doc(`orders/${id}`).set({
        ownerUid: UID,
        status,
        items: [{ format: 'digital', quantity: 1 }],
        createdAt: new Date(Date.now() - daysAgo * day),
      });
    for (const [index, status] of [
      'paid',
      'ready',
      'delivered',
      'shipped',
      'generating',
    ].entries()) {
      await seed(`pro-${String(index)}`, status, 10 + index);
    }
    await seed('pro-refunded', 'refunded', 5);
    await seed('pro-cancelled', 'cancelled', 5);
    await seed('pro-pending', 'pending_payment', 1);
    await seed('pro-old', 'delivered', 100);
    const discount = (await status()).json<{
      discount: { purchases: number; digitalPercent: number; next: { purchases: number } };
    }>().discount;
    expect(discount).toMatchObject({ purchases: 5, digitalPercent: 10, next: { purchases: 10 } });
    const pro = await quoted();
    expect(pro.discount).toEqual({ minor: 8091, reason: 'pro', label: 'Pro 10 %' });

    // Otra cuenta (Familia) no ve el precio Pro.
    const other = await post(
      '/v1/checkout/quote',
      { bookId: 'book-1', format: 'hardcover', country: 'MX' },
      'token-luis',
    );
    expect(other.statusCode).toBe(404);
  });

  it('desarrollo: el pago simulado pasa por el mismo webhook firmado', async () => {
    await approvedBook();
    const { orderId } = (await checkout({ analyticsConsent: false })).json<{ orderId: string }>();
    const view = await app.inject({
      method: 'GET',
      url: `/v1/orders/${orderId}`,
      headers: auth(TOKEN),
    });
    expect(view.json<PublicOrder>().canSimulatePayment).toBe(true);
    const paid = await post(`/v1/dev/orders/${orderId}/simulate-payment`, {});
    expect(paid.json<PublicOrder>().status).toBe('paid');
    expect(conversions.purchases).toEqual([]);
    // Otra persona no ve el pedido.
    const other = await app.inject({
      method: 'GET',
      url: `/v1/orders/${orderId}`,
      headers: auth('token-luis'),
    });
    expect(other.statusCode).toBe(404);
  });
});
