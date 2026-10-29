import {
  BOOK_FORMATS,
  apiRoutes,
  CHARGE_CURRENCY,
  COUNTRY_CODES,
  defaultCountryConfig,
  REFERENCE_CURRENCIES,
  charmPrice,
  unitPriceUsdMinor,
  type BookFormat,
  type FxRates,
  type ProductPricing,
  type CountryCode,
  type CountryConfig,
  type Locale,
  type Offer,
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
/**
 * Lo que se puede comprar en un país (DECISIONS 096 y 097): precio = costo + margen, en dólares
 * (la moneda local va solo como referencia).
 * El impreso se muestra estimado con la imprenta más barata habilitada; la impresión exacta y
 * el envío se cotizan en el checkout, con la dirección.
 */
export function buildOffer(input: {
  code: CountryCode;
  country: CountryConfig;
  pricing: Record<BookFormat, ProductPricing>;
  fx: FxRates;
  products: Product[];
  locale: Locale;
  printOptions?: PrintOption[];
  activePrinters?: readonly string[];
}): Offer {
  const { code, country, pricing, fx, products, locale } = input;
  // Un impreso se ofrece si al menos una imprenta activa lo tiene habilitado con la muestra
  // aprobada (cuál gana se decide al pagar, con la dirección).
  const printable = (format: string) =>
    (input.printOptions ?? []).filter(
      (option) =>
        option.format === format &&
        option.enabled &&
        option.qaSamplePassed &&
        (input.activePrinters ?? []).includes(option.provider),
    );
  const formats = BOOK_FORMATS.flatMap((format) => {
    const product = products.find((p) => p.format === format);
    const productPricing = pricing[format];
    if (!country.active || !country.formats[format] || !product || !productPricing.active) {
      return [];
    }
    const options = format === 'digital' ? [] : printable(format);
    if (format !== 'digital' && options.length === 0) return [];
    const production =
      options.length > 0 ? Math.min(...options.map((option) => option.productionCostUsdMinor)) : 0;
    return [
      {
        format,
        name: product.name[locale],
        pageCount: product.pageCount,
        amountMinor: charmPrice(
          unitPriceUsdMinor(productPricing, production, product.pageCount),
          CHARGE_CURRENCY,
        ),
        estimated: format !== 'digital',
      },
    ];
  });
  const printOptions = BOOK_FORMATS.flatMap((format) =>
    format === 'digital' ? [] : printable(format),
  );
  // Referencia: la moneda del país o, si cobra en dólares, la de la región (Latinoamérica).
  const localCurrency =
    country.currency !== CHARGE_CURRENCY ? country.currency : REFERENCE_CURRENCIES[code];
  const rate = localCurrency ? fx.rates[localCurrency] : undefined;
  return {
    country: code,
    available: formats.length > 0,
    currency: CHARGE_CURRENCY,
    local: localCurrency && rate ? { currency: localCurrency, rate } : null,
    taxBasisPoints: country.taxBasisPoints,
    taxIncludedInPrice: country.taxIncludedInPrice,
    shipping: {
      costMinor: 0,
      etaDaysMin: printOptions.length ? Math.min(...printOptions.map((o) => o.etaDaysMin)) : 0,
      etaDaysMax: printOptions.length ? Math.max(...printOptions.map((o) => o.etaDaysMax)) : 0,
      quoted: true,
    },
    formats,
    printUnavailable:
      country.active &&
      BOOK_FORMATS.some((format) => format !== 'digital' && country.formats[format]) &&
      !formats.some((format) => format.format !== 'digital'),
  };
}

export function registerCatalogRoutes(
  app: FastifyInstance,
  catalog: CatalogRepository,
  activePrinters: readonly string[],
  /** Tipo de cambio del día (para mostrar precios en la moneda de cada país). */
  fxRates: () => Promise<FxRates>,
): void {
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

  // Todos los países se venden (DECISIONS 096): salen de la lista solo los que el admin apagó.
  addRoute(app, apiRoutes.catalogCountries, {}, async () => {
    const configured = await catalog.configuredCountries();
    const off = new Set(configured.filter((country) => !country.active).map((c) => c.code));
    return {
      countries: COUNTRY_CODES.filter((code) => !off.has(code)).map((code) => {
        const country = configured.find((item) => item.code === code) ?? defaultCountryConfig(code);
        return {
          code,
          currency: country.currency,
          defaultLocale: country.defaultLocale,
        };
      }),
    };
  });

  addRoute(app, apiRoutes.catalogEventPricing, {}, async (request) => {
    const { country } = query<'catalogEventPricing'>(request);
    const pricing = await catalog.eventPricing(country);
    if (!pricing) return { pricing: null };
    const { updatedAt: _updatedAt, ...rest } = pricing;
    return { pricing: rest };
  });

  addRoute(app, apiRoutes.catalogOffer, {}, async (request) => {
    const { country: code, locale } = query<'catalogOffer'>(request);
    const [country, pricing, fx, products, printOptions] = await Promise.all([
      catalog.country(code),
      catalog.productPricing(),
      fxRates(),
      catalog.products(),
      catalog.printOptions(code),
    ]);
    return buildOffer({
      code,
      country,
      pricing,
      fx,
      products,
      locale,
      printOptions,
      activePrinters,
    });
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
