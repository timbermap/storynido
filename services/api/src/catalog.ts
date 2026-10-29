import {
  ANY_COUNTRY,
  CHARGE_CURRENCY,
  BOOK_FORMATS,
  DEFAULT_PRODUCT_PRICING,
  defaultCountryConfig,
  productPricingSchema,
  type BookFormat,
  type ProductPricing,
  normalizeFirestoreData,
  printOptionSchema,
  COLLECTIONS,
  collectionSchema,
  type Collection,
  DEFAULT_EDITORIAL_CONFIG,
  GLOBAL_DOC_ID,
  editorialConfigSchema,
  type EditorialConfig,
  type EventPricing,
  type ProDiscountConfig,
  DEFAULT_PRO_DISCOUNTS,
  proDiscountConfigSchema,
  eventPricingSchema,
  contentDocId,
  contentSchema,
  countrySchema,
  createConverter,
  illustrationStyleSchema,
  lessonSchema,
  priceSchema,
  productSchema,
  storySchema,
  type Content,
  type CountryCode,
  type CountryConfig,
  type IllustrationStyle,
  type Lesson,
  type Locale,
  type Price,
  type PrintOption,
  type Product,
  type Story,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

/** Lectura del catálogo público. La escritura es del admin (fase 14). */
export interface CatalogRepository {
  stories(): Promise<Story[]>;
  styles(): Promise<IllustrationStyle[]>;
  lessons(): Promise<Lesson[]>;
  collections(): Promise<Collection[]>;
  countries(): Promise<CountryConfig[]>;
  /** Todos los países configurados, incluidos los apagados por el admin. */
  configuredCountries(): Promise<CountryConfig[]>;
  /** Configuración de un país: la propia (aunque esté apagado) o la de fábrica para el resto. */
  country(code: CountryCode): Promise<CountryConfig>;
  /** Margen y costos de cada producto (o los de fábrica si no se cargaron). */
  productPricing(): Promise<Record<BookFormat, ProductPricing>>;
  prices(country: CountryCode): Promise<Price[]>;
  products(): Promise<Product[]>;
  /**
   * Matriz de impresión de un destino: las opciones del país y las globales (`*`); si una
   * imprenta tiene las dos para el mismo formato, gana la del país.
   */
  printOptions(country: CountryCode): Promise<PrintOption[]>;
  /**
   * Precio del kit de Eventos, en dólares: el del país si tiene uno en USD; si no, el de EE. UU.
   * (el mismo para todo el mundo). Null: no se vende.
   */
  eventPricing(country: CountryCode): Promise<EventPricing | null>;
  content(key: string, locale: Locale): Promise<Content | null>;
  /** Configuración editorial vigente (o la de fábrica si todavía no se cargó). */
  editorial(): Promise<EditorialConfig>;
  /** Descuento Pro por recurrencia (o el de fábrica si todavía no se cargó). */
  proDiscounts(): Promise<ProDiscountConfig>;
}

/** La configuración de Firestore pisa la de fábrica clave por clave (un error no la invalida toda). */
export function mergeEditorialConfig(data: unknown): EditorialConfig {
  const merged = { ...DEFAULT_EDITORIAL_CONFIG, ...(data && typeof data === 'object' ? data : {}) };
  const parsed = editorialConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_EDITORIAL_CONFIG;
}

/** Kit de Eventos en dólares: el del país (activo y en USD) o el de EE. UU. para el resto. */
function usdEventPricing(
  own: EventPricing | null,
  global: EventPricing | null,
): EventPricing | null {
  const usable = (pricing: EventPricing | null) =>
    pricing?.active && pricing.currency === CHARGE_CURRENCY ? pricing : null;
  return usable(own) ?? usable(global);
}

/** Márgenes cargados, y los de fábrica para los productos que falten. */
function withDefaultPricing(stored: ProductPricing[]): Record<BookFormat, ProductPricing> {
  const epoch = new Date(0);
  return Object.fromEntries(
    BOOK_FORMATS.map((format) => [
      format,
      stored.find((item) => item.product === format) ?? {
        ...DEFAULT_PRODUCT_PRICING[format],
        updatedAt: epoch,
      },
    ]),
  ) as Record<BookFormat, ProductPricing>;
}

/** Opciones de un destino: la del país pisa a la global de la misma imprenta y formato. */
function forDestination(options: PrintOption[]): PrintOption[] {
  return options.filter(
    (option) =>
      option.country !== ANY_COUNTRY ||
      !options.some(
        (other) =>
          other.country !== ANY_COUNTRY &&
          other.provider === option.provider &&
          other.format === option.format,
      ),
  );
}

/** Cache en memoria con vencimiento: el catálogo cambia poco y se lee en cada página. */
class TtlCache {
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  async get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
    const value = await load();
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }
}

const converters = {
  stories: createConverter(storySchema),
  styles: createConverter(illustrationStyleSchema),
  lessons: createConverter(lessonSchema),
  collections: createConverter(collectionSchema),
  countries: createConverter(countrySchema),
  prices: createConverter(priceSchema),
  products: createConverter(productSchema),
  content: createConverter(contentSchema),
};

export class FirestoreCatalog implements CatalogRepository {
  private readonly cache: TtlCache;

  constructor(
    private readonly db: Firestore,
    ttlSeconds = 60,
  ) {
    this.cache = new TtlCache(ttlSeconds * 1000);
  }

  stories(): Promise<Story[]> {
    return this.cache.get('stories', async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.stories)
        .withConverter(converters.stories)
        .where('active', '==', true)
        .orderBy('order')
        .get();
      return snapshot.docs.map((doc) => doc.data());
    });
  }

  styles(): Promise<IllustrationStyle[]> {
    return this.cache.get('styles', async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.illustrationStyles)
        .withConverter(converters.styles)
        .where('active', '==', true)
        .orderBy('order')
        .get();
      return snapshot.docs.map((doc) => doc.data());
    });
  }

  lessons(): Promise<Lesson[]> {
    return this.cache.get('lessons', async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.lessons)
        .withConverter(converters.lessons)
        .where('active', '==', true)
        .orderBy('order')
        .get();
      // Los temas sensibles requieren revisión humana: no se ofrecen todavía.
      return snapshot.docs.map((doc) => doc.data()).filter((lesson) => !lesson.sensitive);
    });
  }

  collections(): Promise<Collection[]> {
    return this.cache.get('collections', async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.collections)
        .withConverter(converters.collections)
        .where('active', '==', true)
        .orderBy('order')
        .get();
      return snapshot.docs.map((doc) => doc.data());
    });
  }

  configuredCountries(): Promise<CountryConfig[]> {
    return this.cache.get('countries:all', async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.countries)
        .withConverter(converters.countries)
        .get();
      return snapshot.docs.map((doc) => doc.data());
    });
  }

  countries(): Promise<CountryConfig[]> {
    return this.cache.get('countries', async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.countries)
        .withConverter(converters.countries)
        .where('active', '==', true)
        .get();
      return snapshot.docs.map((doc) => doc.data());
    });
  }

  country(code: CountryCode): Promise<CountryConfig> {
    return this.cache.get(`country:${code}`, async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.countries)
        .withConverter(converters.countries)
        .doc(code)
        .get();
      return snapshot.data() ?? defaultCountryConfig(code);
    });
  }

  productPricing(): Promise<Record<BookFormat, ProductPricing>> {
    return this.cache.get('product-pricing', async () => {
      const snapshot = await this.db.collection(COLLECTIONS.productPricing).get();
      const stored = snapshot.docs.flatMap((doc) => {
        const parsed = productPricingSchema.safeParse(normalizeFirestoreData(doc.data()));
        return parsed.success ? [parsed.data] : [];
      });
      return withDefaultPricing(stored);
    });
  }

  prices(country: CountryCode): Promise<Price[]> {
    return this.cache.get(`prices:${country}`, async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.prices)
        .withConverter(converters.prices)
        .where('country', '==', country)
        .where('active', '==', true)
        .get();
      return snapshot.docs.map((doc) => doc.data());
    });
  }

  products(): Promise<Product[]> {
    return this.cache.get('products', async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.products)
        .withConverter(converters.products)
        .where('active', '==', true)
        .get();
      return snapshot.docs.map((doc) => doc.data());
    });
  }

  printOptions(country: CountryCode): Promise<PrintOption[]> {
    return this.cache.get(`print:${country}`, async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.printOptions)
        .where('country', 'in', [country, ANY_COUNTRY])
        .get();
      return forDestination(
        snapshot.docs.flatMap((doc) => {
          const parsed = printOptionSchema.safeParse(normalizeFirestoreData(doc.data()));
          return parsed.success ? [parsed.data] : [];
        }),
      );
    });
  }

  eventPricing(country: CountryCode): Promise<EventPricing | null> {
    return this.cache.get(`events:${country}`, async () => {
      const read = async (code: CountryCode) => {
        const data = (await this.db.collection(COLLECTIONS.eventPricing).doc(code).get()).data();
        const parsed = data ? eventPricingSchema.safeParse(normalizeFirestoreData(data)) : null;
        return parsed?.success ? parsed.data : null;
      };
      return usdEventPricing(await read(country), country === 'US' ? null : await read('US'));
    });
  }

  content(key: string, locale: Locale): Promise<Content | null> {
    return this.cache.get(`content:${key}:${locale}`, async () => {
      const snapshot = await this.db
        .collection(COLLECTIONS.content)
        .doc(contentDocId(key, locale))
        .withConverter(converters.content)
        .get();
      const content = snapshot.data();
      return content?.published ? content : null;
    });
  }

  editorial(): Promise<EditorialConfig> {
    return this.cache.get('editorial', async () =>
      mergeEditorialConfig(
        (await this.db.collection(COLLECTIONS.editorialConfig).doc(GLOBAL_DOC_ID).get()).data(),
      ),
    );
  }

  proDiscounts(): Promise<ProDiscountConfig> {
    return this.cache.get('pro-discounts', async () => {
      const data = (
        await this.db.collection(COLLECTIONS.proDiscounts).doc(GLOBAL_DOC_ID).get()
      ).data();
      const parsed = data ? proDiscountConfigSchema.safeParse(data) : null;
      return parsed?.success ? parsed.data : DEFAULT_PRO_DISCOUNTS;
    });
  }
}

/** Catálogo fijo para tests. */
export class InMemoryCatalog implements CatalogRepository {
  constructor(
    private readonly data: {
      stories?: Story[];
      styles?: IllustrationStyle[];
      lessons?: Lesson[];
      collections?: Collection[];
      countries?: CountryConfig[];
      prices?: Price[];
      productPricing?: ProductPricing[];
      products?: Product[];
      printOptions?: PrintOption[];
      eventPricing?: EventPricing[];
      proDiscounts?: ProDiscountConfig;
      content?: Content[];
      editorial?: EditorialConfig;
    } = {},
  ) {}

  stories() {
    return Promise.resolve(
      (this.data.stories ?? []).filter((s) => s.active).sort((a, b) => a.order - b.order),
    );
  }

  styles() {
    return Promise.resolve(
      (this.data.styles ?? []).filter((s) => s.active).sort((a, b) => a.order - b.order),
    );
  }

  lessons() {
    return Promise.resolve(
      (this.data.lessons ?? [])
        .filter((l) => l.active && !l.sensitive)
        .sort((a, b) => a.order - b.order),
    );
  }

  countries() {
    return Promise.resolve((this.data.countries ?? []).filter((c) => c.active));
  }

  configuredCountries() {
    return Promise.resolve(this.data.countries ?? []);
  }

  country(code: CountryCode) {
    return Promise.resolve(
      (this.data.countries ?? []).find((c) => c.code === code) ?? defaultCountryConfig(code),
    );
  }

  productPricing() {
    return Promise.resolve(withDefaultPricing(this.data.productPricing ?? []));
  }

  prices(country: CountryCode) {
    return Promise.resolve(
      (this.data.prices ?? []).filter((p) => p.country === country && p.active),
    );
  }

  printOptions(country: CountryCode) {
    return Promise.resolve(
      forDestination(
        (this.data.printOptions ?? []).filter(
          (o) => o.country === country || o.country === ANY_COUNTRY,
        ),
      ),
    );
  }

  eventPricing(country: CountryCode) {
    const find = (code: CountryCode) =>
      (this.data.eventPricing ?? []).find((item) => item.country === code) ?? null;
    return Promise.resolve(usdEventPricing(find(country), find('US')));
  }

  products() {
    return Promise.resolve((this.data.products ?? []).filter((p) => p.active));
  }

  content(key: string, locale: Locale) {
    return Promise.resolve(
      (this.data.content ?? []).find((c) => c.key === key && c.locale === locale && c.published) ??
        null,
    );
  }

  editorial() {
    return Promise.resolve(this.data.editorial ?? DEFAULT_EDITORIAL_CONFIG);
  }

  proDiscounts() {
    return Promise.resolve(this.data.proDiscounts ?? DEFAULT_PRO_DISCOUNTS);
  }

  collections() {
    return Promise.resolve(
      (this.data.collections ?? []).filter((c) => c.active).sort((a, b) => a.order - b.order),
    );
  }
}
