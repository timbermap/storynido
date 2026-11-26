import {
  COLLECTIONS,
  SHOWCASE_MIN_BOOKS,
  showcaseFilePath,
  type ShowcaseBook,
} from '@storynido/shared';
import type { ProviderRegistry } from '@storynido/providers';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
const ADMIN = 'token-admin:admin';

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

const book = (overrides: Partial<ShowcaseBook> = {}): ShowcaseBook => ({
  storySlug: 'el-sonido-escondido',
  channel: 'professionals',
  locale: 'es',
  title: 'Abril y el sonido escondido',
  childName: 'Abril',
  age: 3,
  styleSlug: 'cuento-clasico',
  cover: 'tapa.webp',
  pages: [{ file: 'pagina-1.webp', text: 'Abril escucha.' }],
  panel: { score: 4, weakest: 'chico', verdict: 'compra', buy: 5, judges: {}, loved: [] },
  source: { report: 'pedidos-test', caseId: 'pro-sonido-3', run: 1, arm: null },
  eligible: true,
  reasons: [],
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date(),
  ...overrides,
});

describe('ejemplos de la mesa (DECISIONS 348)', () => {
  let app: App;
  let providers: ProviderRegistry;

  beforeAll(async () => {
    ({ app, providers } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of [COLLECTIONS.showcaseBooks, COLLECTIONS.auditLog]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  const setStatus = (id: string, status: string) =>
    app.inject({
      method: 'PUT',
      url: `/v1/admin/showcase/${id}/status`,
      headers: auth(ADMIN),
      payload: { status },
    });

  it('la sección queda cerrada hasta tener el mínimo aprobado en el idioma', async () => {
    for (let index = 0; index < SHOWCASE_MIN_BOOKS; index += 1) {
      await db.doc(`showcaseBooks/b${String(index)}`).set(book());
    }
    await db.doc('showcaseBooks/en').set(book({ locale: 'en', status: 'approved' }));
    const closed = await app.inject({ method: 'GET', url: '/v1/catalog/showcase?locale=es' });
    expect(closed.json()).toEqual({ open: false, books: [] });

    for (let index = 0; index < SHOWCASE_MIN_BOOKS; index += 1) {
      expect((await setStatus(`b${String(index)}`, 'approved')).statusCode).toBe(200);
    }
    const open = (await app.inject({ method: 'GET', url: '/v1/catalog/showcase?locale=es' })).json<{
      open: boolean;
      books: { id: string; cover: string }[];
    }>();
    expect(open.open).toBe(true);
    expect(open.books).toHaveLength(SHOWCASE_MIN_BOOKS);
    expect(open.books[0]?.cover).toBe('/v1/catalog/showcase/b0/tapa.webp');
    // Un idioma con un solo libro sigue cerrado.
    expect(
      (await app.inject({ method: 'GET', url: '/v1/catalog/showcase?locale=en' })).json(),
    ).toEqual({ open: false, books: [] });

    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'showcase.status')
      .get();
    expect(audit.size).toBe(SHOWCASE_MIN_BOOKS);
  });

  it('no deja aprobar un libro que no califica', async () => {
    await db
      .doc('showcaseBooks/flojo')
      .set(book({ eligible: false, reasons: ['nota de la mesa 3 (mínimo 4)'] }));
    const res = await setStatus('flojo', 'approved');
    expect(res.statusCode).toBe(400);
    expect((await db.doc('showcaseBooks/flojo').get()).get('status')).toBe('pending');
  });

  it('las imágenes solo se sirven aprobadas y de los archivos del libro', async () => {
    await db.doc('showcaseBooks/b1').set(book());
    await providers
      .storage()
      .upload(
        { bucket: 'assets', path: showcaseFilePath('b1', 'tapa.webp') },
        new Uint8Array([1, 2, 3]),
        'image/webp',
      );
    const image = () => app.inject({ method: 'GET', url: '/v1/catalog/showcase/b1/tapa.webp' });
    expect((await image()).statusCode).toBe(404);
    await setStatus('b1', 'approved');
    const served = await image();
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(
      (await app.inject({ method: 'GET', url: '/v1/catalog/showcase/b1/pagina-9.webp' }))
        .statusCode,
    ).toBe(404);
    await setStatus('b1', 'rejected');
    expect((await image()).statusCode).toBe(404);
  });

  it('el admin lista los libros y cuántos hay aprobados', async () => {
    await db.doc('showcaseBooks/b1').set(book({ status: 'approved', reviewedAt: new Date() }));
    await db.doc('showcaseBooks/b2').set(book());
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/showcase',
      headers: auth(ADMIN),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ minBooks: number; approvedByLocale: object; books: unknown[] }>();
    expect(body.minBooks).toBe(SHOWCASE_MIN_BOOKS);
    expect(body.approvedByLocale).toEqual({ es: 1 });
    expect(body.books).toHaveLength(2);
    expect((await app.inject({ method: 'GET', url: '/v1/admin/showcase' })).statusCode).toBe(401);
  });
});
