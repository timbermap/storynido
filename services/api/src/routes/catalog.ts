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
  CONTENT_TYPES,
  editorialPlan,
  pricedPages,
  matrixCostFor,
  stablePrintCost,
  printCandidates,
  printPageCount,
  referenceCurrency,
  referencePrintCost,
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
  /**
   * Impresión por ejemplar según el estimado del país (la imprenta que gana con la dirección de
   * ejemplo; DECISIONS 241). Sin estimado para ese formato y páginas, la matriz.
   */
  printCost?: (format: BookFormat, pages: number) => number | null;
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
  // Impresión por ejemplar: el estimado del país o, si no hay, la matriz (null: no se imprime).
  const productionFor = (format: BookFormat, pages: number) => {
    const matrix = referencePrintCost(options, format, pages, activePrinters);
    if (!matrix) return null;
    return input.printCost?.(format, pages) ?? matrix.productionUsdMinor;
  };
  const offered = BOOK_FORMATS.filter((format) => {
    const product = products.find((p) => p.format === format);
    if (!country.active || !country.formats[format] || !product || !pricing[format].active) {
      return false;
    }
    return format === 'digital' || printable(format).length > 0;
  });
  // Precio exacto de cada formato en cada extensión y tipo de contenido activos (sin envío): la IA
  // y el margen se cuentan por página con ilustración generada; la imprenta, por página impresa.
  const contentTypes = CONTENT_TYPES.filter((type) => editorial.contentTypes[type].active);
  const byLength = BOOK_LENGTHS.filter((length) => editorial.lengths[length].active).flatMap(
    (length) =>
      contentTypes.flatMap((contentType) => {
        const plan = editorialPlan(
          { length, contentType, textDensity: 'balanced', readingLevel: 'developing' },
          editorial,
          editorial.lengths[length].interiorPages,
        );
        const prices = (professional: boolean) =>
          bookFormatPrices({
            country,
            pricing,
            // Nunca menos que el cuento mini (DECISIONS 242).
            pages: pricedPages(plan.narrativePages, editorial),
            professional,
            formats: offered,
            productionUsdMinor: (format) => productionFor(format, plan.interiorPages),
          });
        const pro = prices(true);
        return prices(false).map((item) => ({
          ...item,
          length,
          contentType,
          proAmountMinor:
            pro.find((other) => other.format === item.format)?.amountMinor ?? item.amountMinor,
        }));
      }),
  );
  const formats = offered.flatMap((format) => {
    const product = products.find((p) => p.format === format);
    if (!product) return [];
    // El «desde» del formato: su extensión más corta que se puede hacer, en cuento (sin envío).
    const lengths = byLength.filter(
      (item) => item.format === format && item.contentType === 'story',
    );
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
    lengthPrices: digital.map(({ length, contentType, amountMinor }) => ({
      length,
      contentType,
      amountMinor,
    })),
    proLengthPrices: digital.map(({ length, contentType, proAmountMinor }) => ({
      length,
      contentType,
      amountMinor: proAmountMinor,
    })),
    printLengthPrices: byLength
      .filter((item) => item.format !== 'digital')
      .map(({ format, length, contentType, amountMinor, proAmountMinor }) => ({
        format,
        length,
        contentType,
        amountMinor,
        proAmountMinor,
      })),
    printUnavailable:
      country.active &&
      BOOK_FORMATS.some((format) => format !== 'digital' && country.formats[format]) &&
      !formats.some((format) => format.format !== 'digital'),
  };
}

/** Cuánto espera la oferta una cotización de imprenta antes de usar la matriz. */
const OFFER_ESTIMATE_WAIT_MS = 4000;

export function registerCatalogRoutes(
  app: FastifyInstance,
  catalog: CatalogRepository,
  activePrinters: readonly string[],
  /** Tipo de cambio del día (para mostrar precios en la moneda de cada país). */
  fxRates: () => Promise<FxRates>,
  /** Estimado de impresión del país (dirección de ejemplo; DECISIONS 241). */
  printEstimate?: (
    country: CountryCode,
    format: BookFormat,
    pages: number,
  ) => Promise<{ provider: string; productionUsdMinor: number } | null>,
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
    // El estimado de cada formato impreso en cada extensión que se puede imprimir. Con las
    // cotizaciones en caché es inmediato; si una imprenta tarda, esa extensión usa la matriz.
    const costs = new Map<string, number>();
    if (printEstimate) {
      const combos = BOOK_FORMATS.filter((format) => format !== 'digital').flatMap((format) =>
        BOOK_LENGTHS.map((length) => ({ format, pages: editorial.lengths[length].interiorPages })),
      );
      await Promise.all(
        combos
          .filter(
            ({ format, pages }) =>
              printCandidates(
                printOptions,
                [{ format, pages: printPageCount(format, pages), quantity: 1 }],
                activePrinters,
              ).length > 0,
          )
          .map(async ({ format, pages }) => {
            const estimate = await Promise.race([
              printEstimate(code, format, pages).catch(() => null),
              new Promise<null>((resolve) =>
                setTimeout(() => {
                  resolve(null);
                }, OFFER_ESTIMATE_WAIT_MS),
              ),
            ]);
            if (estimate) {
              // La regla del 5 %: el mismo costo estable que usa el checkout.
              costs.set(
                `${format}:${String(pages)}`,
                stablePrintCost(
                  estimate.productionUsdMinor,
                  matrixCostFor(printOptions, format, estimate.provider, code),
                ),
              );
            }
          }),
      );
    }
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
      printCost: (format, pages) => costs.get(`${format}:${String(pages)}`) ?? null,
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
