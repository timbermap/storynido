import {
  BOOK_FORMATS,
  castNameFor,
  BOOK_LENGTHS,
  DEFAULT_EDITORIAL_CONFIG,
  apiRoutes,
  CHARGE_CURRENCY,
  COUNTRY_CODES,
  EXAMPLE_CHILD_NAME,
  splitTitleAtName,
  withChildName,
  defaultCountryConfig,
  bookFormatPrices,
  bookPriceMinor,
  referenceCurrency,
  type BookFormat,
  type EditorialConfig,
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
  const cast = castNameFor(story.castName ?? EXAMPLE_CHILD_NAME, locale);
  return {
    slug: story.slug,
    // El catálogo es público y todavía no hay nombre: la marca [Nombre] se muestra con el del elenco
    // de la historia (o uno de ejemplo). La portada con título recibe el título partido.
    title: withChildName(story.title[locale], cast),
    titleParts: splitTitleAtName(story.title[locale]),
    coverTitleOverlay: story.coverTitleOverlay,
    coverInk: story.coverInk,
    coverLayout: story.coverLayout,
    coverImagePro: story.coverImagePro ?? null,
    titlePro: story.titlePro?.[locale] ?? null,
    castName: cast,
    defaultStyle: story.defaultStyle ?? null,
    summary: withChildName(story.summary[locale], cast),
    excerpt: withChildName(story.excerpt[locale], cast),
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
    objectives: story.objectives?.map((objective) => objective[locale]) ?? [],
    suggestedLessons: story.suggestedLessons ?? [],
  };
}

/**
 * Lo que se puede comprar en un país (DECISIONS 096, 097 y 236): precio = costo + margen, en
 * dólares (la moneda local va solo como referencia). Cada precio sale de `bookFormatPrices`, el
 * mismo cálculo que el checkout, con las páginas de cada extensión y la imprenta de referencia
 * del país. El envío se cotiza aparte, con la dirección.
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
  /** Extensiones y sus páginas (las del admin); por defecto, las de fábrica. */
  editorial?: EditorialConfig;
}): Offer {
  const { code, country, pricing, fx, products, locale } = input;
  const options = input.printOptions ?? [];
  const activePrinters = input.activePrinters ?? [];
  const editorial = input.editorial ?? DEFAULT_EDITORIAL_CONFIG;
  // Un impreso se ofrece si al menos una imprenta activa lo tiene habilitado con la muestra
  // aprobada (cuál gana se decide al pagar, con la dirección).
  const printable = (format: string) =>
    options.filter(
      (option) =>
        option.format === format &&
        option.enabled &&
        option.qaSamplePassed &&
        activePrinters.includes(option.provider),
    );
  const offered = BOOK_FORMATS.filter((format) => {
    const product = products.find((p) => p.format === format);
    if (!country.active || !country.formats[format] || !product || !pricing[format].active) {
      return false;
    }
    return format === 'digital' || printable(format).length > 0;
  });
  // Precio exacto de cada formato en cada extensión activa (sin envío).
  const byLength = BOOK_LENGTHS.filter((length) => editorial.lengths[length].active).flatMap(
    (length) => {
      const prices = (professional: boolean) =>
        bookFormatPrices({
          country,
          pricing,
          options,
          activeProviders: activePrinters,
          pages: editorial.lengths[length].interiorPages,
          professional,
          formats: offered,
        });
      const pro = prices(true);
      return prices(false).map((item) => ({
        ...item,
        length,
        proAmountMinor:
          pro.find((other) => other.format === item.format)?.amountMinor ?? item.amountMinor,
      }));
    },
  );
  const formats = offered.flatMap((format) => {
    const product = products.find((p) => p.format === format);
    if (!product) return [];
    // El «desde» del formato: su extensión más corta que se puede hacer (sin envío).
    const lengths = byLength.filter((item) => item.format === format);
    const fallback = bookPriceMinor(
      pricing[format],
      format === 'digital'
        ? 0
        : Math.min(...printable(format).map((option) => option.productionCostUsdMinor)),
      product.pageCount,
    );
    return [
      {
        format,
        name: product.name[locale],
        pageCount: product.pageCount,
        amountMinor: lengths.length
          ? Math.min(...lengths.map((item) => item.amountMinor))
          : fallback,
        estimated: format !== 'digital',
      },
    ];
  });
  const digital = byLength.filter((item) => item.format === 'digital');
  const printOptions = offered.flatMap((format) => (format === 'digital' ? [] : printable(format)));
  return {
    country: code,
    available: formats.length > 0,
    currency: CHARGE_CURRENCY,
    // Referencia: la moneda del país o, si cobra en dólares, la de la región (Latinoamérica).
    local: referenceCurrency(code, country, fx),
    taxBasisPoints: country.taxBasisPoints,
    taxIncludedInPrice: country.taxIncludedInPrice,
    shipping: {
      costMinor: 0,
      etaDaysMin: printOptions.length ? Math.min(...printOptions.map((o) => o.etaDaysMin)) : 0,
      etaDaysMax: printOptions.length ? Math.max(...printOptions.map((o) => o.etaDaysMax)) : 0,
      quoted: true,
    },
    formats,
    lengthPrices: digital.map(({ length, amountMinor }) => ({ length, amountMinor })),
    proLengthPrices: digital.map(({ length, proAmountMinor }) => ({
      length,
      amountMinor: proAmountMinor,
    })),
    printLengthPrices: byLength
      .filter((item) => item.format !== 'digital')
      .map(({ format, length, amountMinor, proAmountMinor }) => ({
        format,
        length,
        amountMinor,
        proAmountMinor,
      })),
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
          featuredStory: lesson.featuredStory ?? null,
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
          ...(item.eventType ? { eventType: item.eventType } : {}),
        })),
    };
  });

  // Todos los países se venden (DECISIONS 096): salen de la lista solo los que el admin apagó.
  addRoute(app, apiRoutes.catalogCountries, {}, async () => {
    const [configured, printed] = await Promise.all([
      catalog.configuredCountries(),
      catalog.printedCountries(activePrinters),
    ]);
    const off = new Set(configured.filter((country) => !country.active).map((c) => c.code));
    return {
      countries: COUNTRY_CODES.filter((code) => !off.has(code)).map((code) => {
        const country = configured.find((item) => item.code === code) ?? defaultCountryConfig(code);
        return {
          code,
          currency: country.currency,
          defaultLocale: country.defaultLocale,
          printed: printed === 'all' || printed.includes(code),
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
    const [country, pricing, fx, products, printOptions, editorial] = await Promise.all([
      catalog.country(code),
      catalog.productPricing(),
      fxRates(),
      catalog.products(),
      catalog.printOptions(code),
      catalog.editorial(),
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
      editorial,
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
