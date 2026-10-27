import {
  BOOK_FORMATS,
  apiRoutes,
  type CountryCode,
  type CountryConfig,
  type Locale,
  type Offer,
  type Price,
  type PrintOption,
  type Product,
  type PublicStory,
  type Story,
} from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { CatalogRepository } from '../catalog';
import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

type QueryOf<K extends keyof typeof apiRoutes> = (typeof apiRoutes)[K] extends {
  query: infer Q extends z.ZodType;
}
  ? z.output<Q>
  : never;
type ParamsOf<K extends keyof typeof apiRoutes> = (typeof apiRoutes)[K] extends {
  params: infer P extends z.ZodType;
}
  ? z.output<P>
  : never;

const query = <K extends keyof typeof apiRoutes>(request: FastifyRequest) =>
  request.query as QueryOf<K>;
const params = <K extends keyof typeof apiRoutes>(request: FastifyRequest) =>
  request.params as ParamsOf<K>;

export function toPublicStory(story: Story, locale: Locale): PublicStory {
  return {
    slug: story.slug,
    title: story.title[locale],
    summary: story.summary[locale],
    excerpt: story.excerpt[locale],
    ageMin: story.ageMin,
    ageMax: story.ageMax,
    tags: story.tags,
    pageCount: story.pageCount,
    coverImage: story.coverImage,
    samplePages: story.samplePages,
    lengths: story.lengths,
    textDensities: story.textDensities,
    readingLevels: story.readingLevels,
    contentTypes: story.contentTypes,
    channels: story.channels,
    collectionIds: story.collectionIds,
    personalization: story.personalization,
  };
}

/** Oferta de un país: solo formatos habilitados en el país, con producto activo y precio. */
export function buildOffer(
  code: CountryCode,
  country: CountryConfig | undefined,
  prices: Price[],
  products: Product[],
  locale: Locale,
  printOptions: PrintOption[] = [],
): Offer {
  if (!country) {
    return {
      country: code,
      available: false,
      currency: 'USD',
      taxBasisPoints: 0,
      taxIncludedInPrice: false,
      shipping: { costMinor: 0, etaDaysMin: 0, etaDaysMax: 0 },
      formats: [],
      printUnavailable: false,
    };
  }
  // Un impreso se ofrece solo si la imprenta está habilitada con la muestra aprobada.
  const printable = (format: string) =>
    printOptions.some(
      (option) => option.format === format && option.enabled && option.qaSamplePassed,
    );
  const formats = BOOK_FORMATS.flatMap((format) => {
    const price = prices.find((p) => p.format === format && p.currency === country.currency);
    const product = products.find((p) => p.format === format);
    if (!country.formats[format] || !price || !product) return [];
    if (format !== 'digital' && !printable(format)) return [];
    return [
      {
        format,
        name: product.name[locale],
        pageCount: product.pageCount,
        amountMinor: price.amountMinor,
      },
    ];
  });
  return {
    country: code,
    available: formats.length > 0,
    currency: country.currency,
    taxBasisPoints: country.taxBasisPoints,
    taxIncludedInPrice: country.taxIncludedInPrice,
    shipping: country.shipping,
    formats,
    printUnavailable:
      BOOK_FORMATS.some(
        (format) => format !== 'digital' && country.formats[format] && !printable(format),
      ) && !formats.some((format) => format.format !== 'digital'),
  };
}

export function registerCatalogRoutes(app: FastifyInstance, catalog: CatalogRepository): void {
  addRoute(app, apiRoutes.catalogStories, {}, async (request) => {
    const { locale, age, channel, collection } = query<'catalogStories'>(request);
    const stories = await catalog.stories();
    return {
      stories: stories
        .filter((story) => age === undefined || (story.ageMin <= age && age <= story.ageMax))
        .filter((story) => !channel || story.channels.includes(channel))
        .filter((story) => !collection || story.collectionIds.includes(collection))
        .map((story) => toPublicStory(story, locale)),
    };
  });

  addRoute(app, apiRoutes.catalogStory, {}, async (request) => {
    const { slug } = params<'catalogStory'>(request);
    const { locale } = query<'catalogStory'>(request);
    const story = (await catalog.stories()).find((s) => s.slug === slug);
    if (!story) throw new AppError(404, 'not_found', 'Esa historia no existe.');
    return toPublicStory(story, locale);
  });

  addRoute(app, apiRoutes.catalogLessons, {}, async (request) => {
    const { locale, age } = query<'catalogLessons'>(request);
    const lessons = await catalog.lessons();
    return {
      lessons: lessons
        .filter((lesson) => age === undefined || (lesson.ageMin <= age && age <= lesson.ageMax))
        .map((lesson) => ({
          slug: lesson.slug,
          group: lesson.group,
          name: lesson.name[locale],
          headline: lesson.headline[locale],
          description: lesson.description[locale],
          ageMin: lesson.ageMin,
          ageMax: lesson.ageMax,
        })),
    };
  });

  addRoute(app, apiRoutes.catalogStyles, {}, async (request) => {
    const { locale } = query<'catalogStyles'>(request);
    return {
      styles: (await catalog.styles()).map((style) => ({
        slug: style.slug,
        name: style.name[locale],
        sampleImage: style.sampleImage,
        contentTypes: style.contentTypes,
      })),
    };
  });

  addRoute(app, apiRoutes.catalogEditorial, {}, async () => catalog.editorial());

  addRoute(app, apiRoutes.catalogCollections, {}, async (request) => {
    const { locale, channel } = query<'catalogCollections'>(request);
    return {
      collections: (await catalog.collections())
        .filter((item) => !channel || item.channel === channel)
        .map((item) => ({
          slug: item.slug,
          channel: item.channel,
          name: item.name[locale],
          description: item.description[locale],
          topics: item.topics.map((topic) => topic[locale]),
        })),
    };
  });

  addRoute(app, apiRoutes.catalogCountries, {}, async () => ({
    countries: (await catalog.countries()).map((country) => ({
      code: country.code,
      currency: country.currency,
      defaultLocale: country.defaultLocale,
    })),
  }));

  addRoute(app, apiRoutes.catalogOffer, {}, async (request) => {
    const { country: code, locale } = query<'catalogOffer'>(request);
    const [countries, prices, products, printOptions] = await Promise.all([
      catalog.countries(),
      catalog.prices(code),
      catalog.products(),
      catalog.printOptions(code),
    ]);
    return buildOffer(
      code,
      countries.find((c) => c.code === code),
      prices,
      products,
      locale,
      printOptions,
    );
  });

  addRoute(app, apiRoutes.content, {}, async (request) => {
    const { key } = params<'content'>(request);
    const { locale } = query<'content'>(request);
    const content = await catalog.content(key, locale);
    if (!content) throw new AppError(404, 'not_found', 'Ese contenido no está publicado.');
    return {
      key: content.key,
      locale: content.locale,
      title: content.title,
      body: content.body,
      updatedAt: content.updatedAt.toISOString(),
    };
  });
}
