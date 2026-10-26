import type { Content, CountryConfig, Lesson, Price, Product, Story } from '@storynido/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InMemoryCatalog } from '../catalog';
import { createTestApp } from '../test-helpers';

const now = new Date('2026-10-26T00:00:00Z');
const t = (es: string) => ({ es, en: `${es} (en)`, pt: `${es} (pt)` });

const story = (
  slug: string,
  order: number,
  ageMin: number,
  ageMax: number,
  active = true,
): Story => ({
  slug,
  active,
  order,
  ageMin,
  ageMax,
  tags: [],
  pageCount: 12,
  title: t(`Título ${slug}`),
  summary: t('Resumen'),
  excerpt: t('Fragmento'),
  coverImage: `/samples/${slug}.webp`,
  samplePages: [],
  textPromptTemplate: 'x',
  imagePromptTemplate: 'y',
  createdAt: now,
  updatedAt: now,
});

const lesson = (slug: string, order: number, opts: Partial<Lesson> = {}): Lesson => ({
  slug,
  active: true,
  order,
  group: 'values',
  ageMin: 2,
  ageMax: 8,
  name: t(`Nombre ${slug}`),
  headline: t('Titular'),
  description: t('Descripción'),
  promptGuidance: 'g',
  sensitive: false,
  createdAt: now,
  updatedAt: now,
  ...opts,
});

const mx: CountryConfig = {
  code: 'MX',
  active: true,
  formats: { digital: true, softcover: false, hardcover: true },
  currency: 'MXN',
  defaultLocale: 'es',
  taxBasisPoints: 1600,
  taxIncludedInPrice: true,
  shipping: { costMinor: 9900, etaDaysMin: 5, etaDaysMax: 9 },
  updatedAt: now,
};

const price = (format: Price['format'], amountMinor: number): Price => ({
  country: 'MX',
  format,
  currency: 'MXN',
  amountMinor,
  active: true,
  updatedAt: now,
});

const product = (format: Product['format']): Product => ({
  format,
  pageCount: 24,
  active: true,
  name: t(`Formato ${format}`),
  createdAt: now,
  updatedAt: now,
});

const content = (key: Content['key'], published: boolean): Content => ({
  key,
  locale: 'es',
  title: `Título ${key}`,
  body: '## Hola',
  published,
  updatedAt: now,
  updatedBy: null,
});

describe('catálogo', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp({
      catalog: new InMemoryCatalog({
        stories: [story('b', 2, 4, 10), story('a', 1, 3, 6), story('oculta', 3, 3, 8, false)],
        lessons: [
          lesson('compartir', 2),
          lesson('llega-un-hermanito', 1, { group: 'life', ageMax: 5 }),
          lesson('perdida', 3, { sensitive: true }),
          lesson('inactiva', 4, { active: false }),
        ],
        countries: [mx],
        prices: [price('digital', 34900), price('softcover', 79900), price('hardcover', 99900)],
        products: [product('digital'), product('softcover'), product('hardcover')],
        content: [content('privacy', true), content('faq', false)],
      }),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const get = async (url: string) => ctx.app.inject({ method: 'GET', url });

  it('lista solo historias activas, en orden y traducidas', async () => {
    const res = await get('/v1/catalog/stories?locale=en');
    const { stories } = res.json<{ stories: { slug: string; title: string }[] }>();
    expect(stories.map((s) => s.slug)).toEqual(['a', 'b']);
    expect(stories[0]?.title).toBe('Título a (en)');
  });

  it('filtra por edad', async () => {
    const { stories } = (await get('/v1/catalog/stories?locale=es&age=8')).json<{
      stories: { slug: string }[];
    }>();
    expect(stories.map((s) => s.slug)).toEqual(['b']);
  });

  it('valida idioma y edad', async () => {
    expect((await get('/v1/catalog/stories?locale=fr')).statusCode).toBe(400);
    expect((await get('/v1/catalog/stories?locale=es&age=30')).statusCode).toBe(400);
  });

  it('detalle: 404 para historias inexistentes o inactivas', async () => {
    expect((await get('/v1/catalog/stories/a?locale=pt')).json()).toMatchObject({
      slug: 'a',
      title: 'Título a (pt)',
    });
    expect((await get('/v1/catalog/stories/oculta?locale=es')).statusCode).toBe(404);
    expect((await get('/v1/catalog/stories/nada?locale=es')).statusCode).toBe(404);
  });

  it('la oferta incluye solo formatos habilitados en el país, con precio', async () => {
    const offer = (await get('/v1/catalog/offer?country=MX&locale=es')).json<{
      available: boolean;
      currency: string;
      formats: { format: string; amountMinor: number }[];
    }>();
    expect(offer.available).toBe(true);
    expect(offer.currency).toBe('MXN');
    expect(offer.formats.map((f) => f.format)).toEqual(['digital', 'hardcover']);
  });

  it('un país no activo no está disponible', async () => {
    const offer = (await get('/v1/catalog/offer?country=BR&locale=pt')).json<{
      available: boolean;
      formats: unknown[];
    }>();
    expect(offer).toMatchObject({ available: false, formats: [] });
  });

  it('enseñanzas: activas, en orden, sin temas sensibles y filtradas por edad', async () => {
    const { lessons } = (await get('/v1/catalog/lessons?locale=pt')).json<{
      lessons: { slug: string; name: string }[];
    }>();
    expect(lessons.map((l) => l.slug)).toEqual(['llega-un-hermanito', 'compartir']);
    expect(lessons[1]?.name).toBe('Nombre compartir (pt)');
    const forSeven = (await get('/v1/catalog/lessons?locale=es&age=7')).json<{
      lessons: { slug: string }[];
    }>();
    expect(forSeven.lessons.map((l) => l.slug)).toEqual(['compartir']);
  });

  it('países activos', async () => {
    expect((await get('/v1/catalog/countries')).json()).toEqual({
      countries: [{ code: 'MX', currency: 'MXN', defaultLocale: 'es' }],
    });
  });

  it('contenido: solo lo publicado', async () => {
    const privacy = await get('/v1/content/privacy?locale=es');
    expect(privacy.json()).toMatchObject({
      key: 'privacy',
      title: 'Título privacy',
      updatedAt: now.toISOString(),
    });
    expect((await get('/v1/content/faq?locale=es')).statusCode).toBe(404);
    expect((await get('/v1/content/inventado?locale=es')).statusCode).toBe(400);
  });
});
