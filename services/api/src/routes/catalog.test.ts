import {
  DEFAULT_PRODUCT_PRICING,
  type BookFormat,
  type Content,
  type CountryConfig,
  type Lesson,
  type Price,
  type Product,
  type ProductPricing,
  type Story,
} from '@storynido/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InMemoryCatalog } from '../catalog';
import { buildOffer } from './catalog';
import { TEST_FX, createTestApp } from '../test-helpers';

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
  lengths: ['mini', 'classic'],
  textDensities: ['visual', 'balanced'],
  readingLevels: ['beginner', 'developing'],
  contentTypes: ['story'],
  channels: ['families'],
  collectionIds: [],
  personalization: { photo: true, avatar: true, memories: true, lessons: true },
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
  lengthAdjustmentsMinor: {},
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
        printOptions: [
          {
            country: 'MX',
            format: 'hardcover',
            provider: 'mock',
            sku: 'photobook-hardcover-210x280',
            enabled: true,
            qaSamplePassed: true,
            pages: { min: 12, max: 120, multipleOf: 2 },
            maxQuantity: 50,
            etaDaysMin: 6,
            etaDaysMax: 10,
            productionCostUsdMinor: 1400,
            updatedAt: now,
          },
        ],
        stories: [
          story('b', 2, 4, 10),
          story('a', 1, 3, 6),
          story('oculta', 3, 3, 8, false),
          {
            ...story('dentista', 4, 3, 8),
            channels: ['professionals', 'families'],
            collectionIds: ['mi-primera-experiencia'],
          },
          { ...story('cumple', 5, 2, 10), channels: ['events'], collectionIds: ['cumpleanos'] },
        ],
        collections: [
          {
            slug: 'mi-primera-experiencia',
            active: true,
            order: 2,
            channel: 'professionals',
            name: t('Mi primera experiencia'),
            description: t('Para anticipar situaciones nuevas.'),
            topics: [t('Visita al dentista')],
            createdAt: now,
            updatedAt: now,
          },
          {
            slug: 'cumpleanos',
            active: true,
            order: 1,
            channel: 'events',
            name: t('Cumpleaños'),
            description: t('Un cuento para cada invitado.'),
            topics: [],
            createdAt: now,
            updatedAt: now,
          },
          {
            slug: 'borrador',
            active: false,
            order: 3,
            channel: 'events',
            name: t('Borrador'),
            description: t('x'),
            topics: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        lessons: [
          lesson('compartir', 2),
          lesson('llega-un-hermanito', 1, { group: 'life', ageMax: 5 }),
          lesson('perdida', 3, { sensitive: true }),
          lesson('inactiva', 4, { active: false }),
        ],
        countries: [mx, { ...mx, code: 'BR', currency: 'BRL', active: false }],
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
    expect(stories.map((s) => s.slug)).toEqual(['a', 'b', 'dentista', 'cumple']);
    expect(stories[0]?.title).toBe('Título a (en)');
  });

  it('filtra por edad', async () => {
    const { stories } = (await get('/v1/catalog/stories?locale=es&age=8')).json<{
      stories: { slug: string }[];
    }>();
    expect(stories.map((s) => s.slug)).toEqual(['b', 'dentista', 'cumple']);
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

  it('la oferta: formatos habilitados, costo + margen en pesos y envío a cotizar', async () => {
    const offer = (await get('/v1/catalog/offer?country=MX&locale=es')).json<{
      available: boolean;
      currency: string;
      local: unknown;
      shipping: { costMinor: number; quoted: boolean; etaDaysMin: number; etaDaysMax: number };
      formats: { format: string; amountMinor: number; estimated: boolean }[];
    }>();
    expect(offer.available).toBe(true);
    // Todo en dólares (DECISIONS 097); el peso va solo como referencia.
    expect(offer.currency).toBe('USD');
    expect(offer.local).toEqual({ currency: 'MXN', rate: 20 });
    // 24 páginas. Digital: 0,15 × 24 + 17 = 20,60 → 20,99.
    // Tapa dura: 20,60 + imprenta 14 + 8 (mínimo de impresión) = 42,60 → 42,99.
    expect(offer.formats).toEqual([
      expect.objectContaining({ format: 'digital', amountMinor: 2099, estimated: false }),
      expect.objectContaining({ format: 'hardcover', amountMinor: 4299, estimated: true }),
    ]);
    expect(offer.shipping).toEqual({ costMinor: 0, quoted: true, etaDaysMin: 6, etaDaysMax: 10 });
  });

  it('un país sin configuración propia se vende en dólares (somos globales)', async () => {
    const offer = (await get('/v1/catalog/offer?country=AR&locale=es')).json<{
      available: boolean;
      currency: string;
      formats: { format: string; amountMinor: number }[];
    }>();
    expect(offer).toMatchObject({ available: true, currency: 'USD' });
    expect(offer.formats[0]).toMatchObject({ format: 'digital', amountMinor: 2099 });
  });

  it('sin imprenta habilitada (o sin muestra aprobada) el impreso no se ofrece', () => {
    const country = { ...mx, formats: { digital: true, softcover: true, hardcover: true } };
    const products = [product('digital'), product('softcover'), product('hardcover')];
    const pricing = Object.fromEntries(
      (['digital', 'softcover', 'hardcover'] as const).map((format) => [
        format,
        { ...DEFAULT_PRODUCT_PRICING[format], updatedAt: now },
      ]),
    ) as Record<BookFormat, ProductPricing>;
    const offer = buildOffer({
      code: 'MX',
      country,
      pricing,
      fx: TEST_FX,
      products,
      locale: 'es',
      printOptions: [],
      activePrinters: ['mock'],
    });
    expect(offer.formats.map((f) => f.format)).toEqual(['digital']);
    expect(offer.printUnavailable).toBe(true);
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

  it('publica la configuración editorial (con valores de fábrica si no hay)', async () => {
    const res = await get('/v1/catalog/editorial');
    expect(res.statusCode).toBe(200);
    const config = res.json<{
      lengths: Record<string, { interiorPages: number }>;
      defaults: { textDensity: string };
    }>();
    expect(config.lengths.classic?.interiorPages).toBe(28);
    expect(config.lengths.mini?.interiorPages).toBe(12);
    expect(config.defaults.textDensity).toBe('balanced');
  });

  it('filtra historias por línea comercial y colección (una historia puede estar en varias)', async () => {
    const slugs = async (url: string) =>
      (await get(url)).json<{ stories: { slug: string }[] }>().stories.map((item) => item.slug);
    expect(await slugs('/v1/catalog/stories?locale=es&channel=events')).toEqual(['cumple']);
    expect(await slugs('/v1/catalog/stories?locale=es&channel=professionals')).toEqual([
      'dentista',
    ]);
    expect(await slugs('/v1/catalog/stories?locale=es&channel=families')).toContain('dentista');
    expect(await slugs('/v1/catalog/stories?locale=es&collection=mi-primera-experiencia')).toEqual([
      'dentista',
    ]);
  });

  it('lista colecciones activas por línea, con sus temas traducidos', async () => {
    const res = await get('/v1/catalog/collections?locale=es&channel=professionals');
    const { collections } = res.json<{ collections: { slug: string; topics: string[] }[] }>();
    expect(collections).toEqual([
      expect.objectContaining({ slug: 'mi-primera-experiencia', topics: ['Visita al dentista'] }),
    ]);
    const all = (await get('/v1/catalog/collections?locale=en')).json<{
      collections: { slug: string; name: string }[];
    }>().collections;
    expect(all.map((item) => item.slug)).toEqual(['cumpleanos', 'mi-primera-experiencia']);
    expect(all[0]?.name).toBe('Cumpleaños (en)');
  });
});
