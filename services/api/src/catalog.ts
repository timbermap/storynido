import {
  normalizeFirestoreData,
  printOptionSchema,
  COLLECTIONS,
  collectionSchema,
  type Collection,
  DEFAULT_EDITORIAL_CONFIG,
  GLOBAL_DOC_ID,
  editorialConfigSchema,
  type EditorialConfig,
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
  prices(country: CountryCode): Promise<Price[]>;
  products(): Promise<Product[]>;
  /** Matriz de impresión del país (qué formato se puede imprimir, con qué reglas). */
  printOptions(country: CountryCode): Promise<PrintOption[]>;
  content(key: string, locale: Locale): Promise<Content | null>;
  /** Configuración editorial vigente (o la de fábrica si todavía no se cargó). */
  editorial(): Promise<EditorialConfig>;
}

/** La configuración de Firestore pisa la de fábrica clave por clave (un error no la invalida toda). */
export function mergeEditorialConfig(data: unknown): EditorialConfig {
  const merged = { ...DEFAULT_EDITORIAL_CONFIG, ...(data && typeof data === 'object' ? data : {}) };
  const parsed = editorialConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_EDITORIAL_CONFIG;
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
        .where('country', '==', country)
        .get();
      return snapshot.docs.flatMap((doc) => {
        const parsed = printOptionSchema.safeParse(normalizeFirestoreData(doc.data()));
        return parsed.success ? [parsed.data] : [];
      });
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
      products?: Product[];
      printOptions?: PrintOption[];
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

  prices(country: CountryCode) {
    return Promise.resolve(
      (this.data.prices ?? []).filter((p) => p.country === country && p.active),
    );
  }

  printOptions(country: CountryCode) {
    return Promise.resolve((this.data.printOptions ?? []).filter((o) => o.country === country));
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

  collections() {
    return Promise.resolve(
      (this.data.collections ?? []).filter((c) => c.active).sort((a, b) => a.order - b.order),
    );
  }
}
