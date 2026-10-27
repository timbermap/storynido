/**
 * Vista previa de punta a punta con emuladores (Firestore), storage local e IA simulada:
 * generación, cuotas, presupuesto, regeneraciones, edición moderada y configuración de IA.
 */
import { MOCK_UNSAFE_MARKER, type ProviderRegistry } from '@storynido/providers';
import {
  countWords,
  utcDay,
  type IllustrationStyle,
  type Lesson,
  type PublicPreview,
  type Story,
} from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryCatalog } from '../catalog';
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

  it('la extensión y la cantidad de texto son independientes (24 páginas, visual o más lectura)', async () => {
    await seedBook(providers, 'book-visual', { length: 'classic', textDensity: 'visual' });
    await seedBook(providers, 'book-rich', { length: 'classic', textDensity: 'rich' });
    const visual = (await generateAndApprove('book-visual')).json<PublicPreview>();
    const rich = (await generateAndApprove('book-rich')).json<PublicPreview>();
    expect(visual.preview?.totalPages).toBe(24);
    expect(rich.preview?.totalPages).toBe(24);
    const words = (text: string) => countWords(text);
    for (const page of visual.preview?.pages ?? []) {
      expect(words(page.text)).toBeGreaterThanOrEqual(5);
      expect(words(page.text)).toBeLessThanOrEqual(20);
    }
    for (const page of rich.preview?.pages ?? []) {
      expect(words(page.text)).toBeGreaterThanOrEqual(70);
      expect(words(page.text)).toBeLessThanOrEqual(120);
    }
    // El cuento completo tiene las páginas narrativas de la extensión (24 - 2 fijas).
    const book = await db.doc('books/book-rich').get();
    expect((book.get('preview.pages') as unknown[]).length).toBe(22);
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
