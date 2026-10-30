/**
 * Datos de desarrollo para los emuladores: usuarios de prueba con roles,
 * configuración de países, productos, precios, sitio e IA.
 * Se niega a correr fuera de los emuladores.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';

import {
  BOOK_FORMATS,
  COLLECTIONS,
  CONTENT_KEYS,
  LOCALES,
  CONFIGURED_COUNTRIES,
  countryDefaults,
  GLOBAL_DOC_ID,
  DEFAULT_EDITORIAL_CONFIG,
  activityTemplateSchema,
  aiConfigSchema,
  collectionSchema,
  editorialConfigSchema,
  contentDocId,
  contentSchema,
  countrySchema,
  illustrationStyleSchema,
  lessonSchema,
  productSchema,
  siteConfigSchema,
  storySchema,
  userSchema,
  type BookFormat,
  BOOKLET_PAGES,
  PHOTOBOOK_FORMATS,
  PRINT_FORMATS,
  ANY_COUNTRY,
  CLOUDPRINTER_PRODUCTS,
  DEFAULT_PRODUCT_PRICING,
  productPricingSchema,
  utcDay,
  DEFAULT_PRO_DISCOUNTS,
  aiModelSchema,
  GELATO_CARD_US,
  GELATO_PRODUCTS,
  type PhotobookFormat,
  type PrintFormat,
  LULU_PRODUCTS,
  proDiscountConfigSchema,
  eventPricingSchema,
  printOptionId,
  printOptionSchema,
  type CountryCode,
  type Locale,
  type Role,
} from '@storynido/shared';

import {
  SEED_ACTIVITY_TEMPLATES,
  SEED_NEW_STORIES,
  SEED_STORIES,
  SEED_STYLES,
} from '../seed-data/catalog';
import { SEED_COLLECTIONS } from '../seed-data/collections';
import { SEED_LESSONS } from '../seed-data/lessons';
import { initAdmin, isUsingEmulators } from './admin';

/**
 * Dos modos:
 * - Emuladores (por defecto): datos de ejemplo completos, con usuarios de prueba.
 * - Nube (`--project storynido-…`): solo catálogo y configuración, sin usuarios, y solo crea lo
 *   que falta (nunca pisa lo que se haya editado después, por ejemplo desde el admin).
 */
const projectFlag = process.argv.indexOf('--project');
const cloudProject = projectFlag >= 0 ? process.argv[projectFlag + 1] : undefined;
const cloud = !isUsingEmulators();
/** Producción arranca sin nada simulado, con precios inactivos y el sitio en "Solo vista previa". */
const production = cloudProject === 'storynido-prod';
/** En la nube, `--refresh-catalog` reescribe historias, estilos y enseñanzas (no la configuración). */
const refreshCatalog = process.argv.includes('--refresh-catalog');
/**
 * En la nube, `--refresh-print` reescribe la matriz de imprentas (printOptions) con los países
 * verificados del seed y borra las opciones que ya no existen. Pisa lo editado en el admin.
 */
const refreshPrint = process.argv.includes('--refresh-print');
/**
 * `--refresh-content privacy,terms` reescribe esos textos (en los tres idiomas) con los de
 * seed-data/content: para publicar un cambio legal. Pisa lo editado en el admin.
 */
const contentFlag = process.argv.indexOf('--refresh-content');
const refreshContent = new Set(
  contentFlag >= 0 ? (process.argv[contentFlag + 1] ?? '').split(',').filter(Boolean) : [],
);
const CATALOG_COLLECTIONS = new Set<string>([
  COLLECTIONS.stories,
  COLLECTIONS.collections,
  COLLECTIONS.illustrationStyles,
  COLLECTIONS.lessons,
  COLLECTIONS.activityTemplates,
]);

if (cloud && !cloudProject?.startsWith('storynido-')) {
  console.error(
    'Fuera de los emuladores el seed exige --project storynido-<ambiente> (nunca Timbermap).',
  );
  process.exit(1);
}

const app = initAdmin(cloud ? cloudProject : undefined);
const auth = getAuth(app);
const db = getFirestore(app);
const now = new Date();

const USERS: { email: string; displayName: string; role: Role }[] = [
  { email: 'cliente@storynido.test', displayName: 'Cliente de prueba', role: 'customer' },
  { email: 'admin@storynido.test', displayName: 'Admin de prueba', role: 'admin' },
  { email: 'superadmin@storynido.test', displayName: 'Superadmin de prueba', role: 'superadmin' },
];

async function upsertUser(email: string, displayName: string): Promise<UserRecord> {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return auth.createUser({ email, displayName, emailVerified: true });
  }
}

for (const { email, displayName, role } of cloud ? [] : USERS) {
  const user = await upsertUser(email, displayName);
  await auth.setCustomUserClaims(user.uid, role === 'customer' ? {} : { role });
  await db
    .collection(COLLECTIONS.users)
    .doc(user.uid)
    .set(
      userSchema.parse({
        email,
        displayName,
        photoURL: null,
        locale: 'es',
        country: 'MX',
        marketingOptIn: false,
        role,
        createdAt: now,
        updatedAt: now,
      }),
    );
}

const SAMPLE_SHIPPING: Partial<
  Record<CountryCode, { costMinor: number; etaDaysMin: number; etaDaysMax: number }>
> = {
  MX: { costMinor: 9900, etaDaysMin: 5, etaDaysMax: 9 },
  US: { costMinor: 699, etaDaysMin: 4, etaDaysMax: 8 },
};

/** Páginas que acepta la imprenta simulada según el formato. */
const mockPages = (format: PrintFormat) =>
  format === 'booklet'
    ? { ...BOOKLET_PAGES }
    : format === 'card'
      ? { min: 1, max: 1, multipleOf: 1 }
      : { min: format === 'hardcover' ? 20 : 12, max: 120, multipleOf: 2 };

const writes: { ref: DocumentReference; data: object }[] = [];
/** En la nube solo se crean los documentos que faltan; en los emuladores se reescriben. */
const batch = {
  set(ref: DocumentReference, data: object) {
    writes.push({ ref, data });
  },
  delete(ref: DocumentReference) {
    if (!cloud || (refreshPrint && ref.parent.id === COLLECTIONS.printOptions)) void ref.delete();
  },
};

for (const code of CONFIGURED_COUNTRIES) {
  const defaults = countryDefaults(code);
  // Somos globales (DECISIONS 096): todos los países se venden; el admin apaga el que haga falta.
  const launched = true;
  batch.set(
    db.collection(COLLECTIONS.countries).doc(code),
    countrySchema.parse({
      code,
      active: launched,
      formats: { digital: launched, softcover: launched, hardcover: launched },
      currency: defaults.currency,
      defaultLocale: defaults.defaultLocale,
      taxBasisPoints: code === 'MX' ? 1600 : 0,
      taxIncludedInPrice: code === 'MX',
      shipping: SAMPLE_SHIPPING[code] ?? { costMinor: 0, etaDaysMin: 0, etaDaysMax: 0 },
      updatedAt: now,
    }),
  );
}

// Precio = costo + margen por producto (DECISIONS 096): los de fábrica, editables en el admin.
// En producción se revisan y activan antes de vender.
for (const format of BOOK_FORMATS) {
  batch.set(
    db.collection(COLLECTIONS.productPricing).doc(format),
    productPricingSchema.parse({
      ...DEFAULT_PRODUCT_PRICING[format],
      active: !production,
      updatedAt: now,
    }),
  );
}

// Tipo de cambio fijo en los emuladores: los precios no dependen de internet (local y E2E).
if (!cloud) {
  batch.set(db.collection(COLLECTIONS.fxRates).doc(utcDay(now)), {
    rates: { USD: 1, MXN: 18.5, EUR: 0.92, COP: 4000, CLP: 940, PEN: 3.75, BRL: 5.4 },
    source: 'seed (fijo, solo emuladores)',
    date: utcDay(now),
  });
}

// Matriz de impresión de ejemplo con la imprenta simulada (la real se habilita desde el admin
// recién con la muestra física aprobada).
// Producción no tiene imprentas simuladas.
const SAMPLE_PRINT: Partial<Record<CountryCode, { etaDaysMin: number; etaDaysMax: number }>> =
  production
    ? {}
    : {
        MX: { etaDaysMin: 6, etaDaysMax: 11 },
        US: { etaDaysMin: 5, etaDaysMax: 9 },
      };
for (const [code, eta] of Object.entries(SAMPLE_PRINT) as [
  CountryCode,
  { etaDaysMin: number; etaDaysMax: number },
][]) {
  for (const format of PRINT_FORMATS) {
    // Matriz anterior a varias imprentas ({país}_{formato}): la reemplaza la de abajo.
    await db.collection(COLLECTIONS.printOptions).doc(`${code}_${format}`).delete();
    // En EE. UU. compiten dos imprentas simuladas (mock_alt solo se usa si está activa).
    const printers = code === 'US' ? ['mock', 'mock_alt'] : ['mock'];
    for (const provider of printers) {
      batch.set(
        db.collection(COLLECTIONS.printOptions).doc(printOptionId(code, format, provider)),
        printOptionSchema.parse({
          country: code,
          format,
          provider,
          sku: `photobook-${format}-210x280`,
          enabled: true,
          qaSamplePassed: true,
          pages: mockPages(format),
          maxQuantity: 100,
          ...eta,
          productionCostUsdMinor:
            (format === 'card'
              ? 25
              : format === 'booklet'
                ? 700
                : format === 'hardcover'
                  ? 1400
                  : 900) + (provider === 'mock_alt' ? 150 : 0),
          updatedAt: now,
        }),
      );
    }
  }
}

// Imprentas reales (DECISIONS 076, 080, 086, 138): solo se ofrece impreso en los países donde
// la imprenta cotizó y entregó de verdad (cotizaciones reales del 2026-10-30, libro de 32
// páginas, 1 ejemplar; costo de producción en centavos de USD y plazo de producción + envío).
// Fuera de esta lista el libro queda solo digital hasta verificar el país. El envío se cotiza
// al pagar, con la dirección; el enrutador elige la imprenta más barata.
type PrintCell = [softcover: number, hardcover: number | null, etaMin: number, etaMax: number];
const VERIFIED_PRINT: Record<
  string,
  {
    sku: Record<PhotobookFormat, string>;
    pagesMin: number;
    countries: Partial<Record<CountryCode, PrintCell>>;
  }
> = {
  gelato: {
    sku: GELATO_PRODUCTS,
    pagesMin: 28,
    countries: {
      US: [1051, 1373, 6, 10],
      MX: [1493, 1950, 11, 18],
      AR: [1493, 1950, 6, 10],
      UY: [1493, 1950, 6, 10],
      BR: [1492, 1948, 14, 25],
      ES: [1136, 1483, 7, 10],
      CH: [1493, 1950, 6, 7],
    },
  },
  cloudprinter: {
    sku: CLOUDPRINTER_PRODUCTS,
    pagesMin: 24,
    countries: {
      US: [1425, 3298, 5, 10],
      MX: [575, 1131, 4, 8],
      AR: [575, 1131, 4, 8],
      UY: [575, 1131, 4, 8],
      BR: [575, 1131, 4, 8],
      // A España no cotiza tapa dura.
      ES: [870, null, 2, 5],
      CH: [645, 1193, 5, 10],
    },
  },
  // Lulu (sandbox fuera de producción) pide el documento fiscal del destinatario en México,
  // Argentina y Brasil: el pago lo pide (opcional) y sin él su cotización falla y gana otra.
  lulu: {
    sku: LULU_PRODUCTS,
    pagesMin: 24,
    countries: {
      US: [559, 1494, 8, 16],
      UY: [494, 1376, 8, 16],
      // Con el documento fiscal del destinatario (opcional en el pago).
      MX: [494, 1376, 8, 16],
      AR: [494, 1376, 8, 16],
      BR: [494, 1376, 8, 16],
      ES: [549, 1466, 8, 16],
      CH: [494, 1376, 8, 16],
    },
  },
};
for (const [provider, printer] of Object.entries(VERIFIED_PRINT)) {
  for (const [code, [softcover, hardcover, etaMin, etaMax]] of Object.entries(
    printer.countries,
  ) as [CountryCode, PrintCell][]) {
    for (const format of PHOTOBOOK_FORMATS) {
      const id = printOptionId(code, format, provider);
      const cost = format === 'hardcover' ? hardcover : softcover;
      if (cost === null) {
        batch.delete(db.collection(COLLECTIONS.printOptions).doc(id));
        continue;
      }
      batch.set(
        db.collection(COLLECTIONS.printOptions).doc(id),
        printOptionSchema.parse({
          country: code,
          format,
          provider,
          sku: printer.sku[format],
          enabled: true,
          // En producción se habilita recién con la muestra física aprobada.
          qaSamplePassed: !production,
          pages: { min: printer.pagesMin, max: 200, multipleOf: 2 },
          maxQuantity: 100,
          etaDaysMin: etaMin,
          etaDaysMax: etaMax,
          productionCostUsdMinor: cost,
          updatedAt: now,
        }),
      );
    }
  }
  // Ya no hay opciones "cualquier país" de imprentas reales: se borran las anteriores.
  for (const format of PRINT_FORMATS) {
    batch.delete(
      db.collection(COLLECTIONS.printOptions).doc(printOptionId(ANY_COUNTRY, format, provider)),
    );
  }
}

// Cuento grapado A5 (DECISIONS 138): solo Gelato lo hace. Cotización real de 16 páginas (el Mini
// con tapas), 1 ejemplar: producción USD 9,96 y plazo de producción + envío. Con más ejemplares el
// costo unitario baja (30: USD 2,04 c/u); el precio se calcula con el total cotizado al pagar.
const GELATO_BOOKLET: Partial<Record<CountryCode, [etaMin: number, etaMax: number]>> = {
  US: [10, 12],
  MX: [11, 18],
  AR: [14, 25],
  UY: [14, 25],
  BR: [14, 25],
  ES: [7, 10],
  CH: [6, 7],
};
for (const [code, [etaMin, etaMax]] of Object.entries(GELATO_BOOKLET) as [
  CountryCode,
  [number, number],
][]) {
  batch.set(
    db.collection(COLLECTIONS.printOptions).doc(printOptionId(code, 'booklet', 'gelato')),
    printOptionSchema.parse({
      country: code,
      format: 'booklet',
      provider: 'gelato',
      sku: GELATO_PRODUCTS.booklet,
      enabled: true,
      qaSamplePassed: !production,
      pages: { ...BOOKLET_PAGES },
      maxQuantity: 500,
      etaDaysMin: etaMin,
      etaDaysMax: etaMax,
      productionCostUsdMinor: 996,
      updatedAt: now,
    }),
  );
}
batch.delete(
  db.collection(COLLECTIONS.printOptions).doc(printOptionId(ANY_COUNTRY, 'booklet', 'gelato')),
);

// Tarjetas 5×7" del kit de Celebraciones (DECISIONS 140): solo Gelato. Cotización real de 2
// diseños de 30 copias (USD 13,62 en total: unos 23 centavos por tarjeta) y plazo con el envío.
// En EE. UU. es otro papel (el SKU lo elige el adaptador según el país).
const GELATO_CARD: Partial<Record<CountryCode, [etaMin: number, etaMax: number]>> = {
  US: [7, 11],
  MX: [11, 18],
  AR: [5, 7],
  UY: [5, 7],
  BR: [14, 25],
  ES: [5, 6],
  CH: [5, 6],
};
for (const [code, [etaMin, etaMax]] of Object.entries(GELATO_CARD) as [
  CountryCode,
  [number, number],
][]) {
  batch.set(
    db.collection(COLLECTIONS.printOptions).doc(printOptionId(code, 'card', 'gelato')),
    printOptionSchema.parse({
      country: code,
      format: 'card',
      provider: 'gelato',
      sku: code === 'US' ? GELATO_CARD_US : GELATO_PRODUCTS.card,
      enabled: true,
      qaSamplePassed: !production,
      pages: { min: 1, max: 1, multipleOf: 1 },
      maxQuantity: 500,
      etaDaysMin: etaMin,
      etaDaysMax: etaMax,
      productionCostUsdMinor: 23,
      updatedAt: now,
    }),
  );
}
batch.delete(
  db.collection(COLLECTIONS.printOptions).doc(printOptionId(ANY_COUNTRY, 'card', 'gelato')),
);

// La imprenta simulada (fuera de producción) sí atiende cualquier destino, para las pruebas.
if (!production) {
  for (const format of PRINT_FORMATS) {
    batch.set(
      db.collection(COLLECTIONS.printOptions).doc(printOptionId(ANY_COUNTRY, format, 'mock')),
      printOptionSchema.parse({
        country: ANY_COUNTRY,
        format,
        provider: 'mock',
        sku: `photobook-${format}-210x280`,
        enabled: true,
        qaSamplePassed: true,
        pages: mockPages(format),
        maxQuantity: 100,
        etaDaysMin: 7,
        etaDaysMax: 20,
        productionCostUsdMinor:
          format === 'card' ? 25 : format === 'booklet' ? 700 : format === 'hardcover' ? 1400 : 900,
        updatedAt: now,
      }),
    );
  }
}

// Kit de Eventos (DECISIONS 079): precios de ejemplo, editables en el admin (fase 14). El
// diseño incluye el librito; cada pieza extra es una licencia digital (las copias no cambian el
// precio: la licencia dice cuántas se pueden imprimir).
// En dólares, el mismo para todo el mundo (DECISIONS 097): se guarda en el documento de EE. UU.
batch.set(
  db.collection(COLLECTIONS.eventPricing).doc('US'),
  eventPricingSchema.parse({
    country: 'US',
    currency: 'USD',
    active: true,
    designMinor: 1499,
    pieces: { activities: 299, invitation: 399, thank_you: 299, stickers: 349, favor_tags: 299 },
    updatedAt: now,
  }),
);

// Descuento Pro por recurrencia (DECISIONS 081): escalones de fábrica, editables en el admin.
batch.set(
  db.collection(COLLECTIONS.proDiscounts).doc(GLOBAL_DOC_ID),
  proDiscountConfigSchema.parse(DEFAULT_PRO_DISCOUNTS),
);

// Catálogo de modelos de IA (DECISIONS 087): los de Vertex que ya se usan, con su precio de lista.
// Vertex no entrena con los datos de los clientes (términos de Google Cloud). Pendiente: confirmar
// la exención del monitoreo de abuso (revisión humana) antes de producción.
const VERTEX_MODELS = [
  { model: 'gemini-3.5-flash', kind: 'text', input: 0.5, output: 3 },
  { model: 'gemini-3.1-flash-lite', kind: 'text', input: 0.1, output: 0.4 },
  { model: 'gemini-3.1-flash-image', kind: 'image', input: 0.5, output: 60 },
  { model: 'gemini-3-pro-image', kind: 'image', input: 2, output: 120 },
] as const;
for (const entry of VERTEX_MODELS) {
  batch.set(
    db.collection(COLLECTIONS.aiModels).doc(entry.model),
    aiModelSchema.parse({
      provider: 'vertex',
      model: entry.model,
      kind: entry.kind,
      price: { inputPerMTok: entry.input, outputPerMTok: entry.output },
      dataPolicy: {
        trainsOnData: false,
        humanReview: false,
        regions: ['global'],
        enterpriseAgreement: true,
      },
      allowedEnvironments: ['local', 'staging', 'production'],
      childPhotosAllowed: entry.kind === 'image',
      lastEval: null,
      notes: 'Precio de lista de Vertex AI (revisar en la consola).',
    }),
  );
}

// Cupón de prueba (solo en los emuladores): 10 % para probar el checkout.
if (!cloud) {
  batch.set(db.collection(COLLECTIONS.coupons).doc('PRUEBA10'), {
    code: 'PRUEBA10',
    type: 'percent',
    value: 10,
    currency: null,
    countries: [],
    validFrom: new Date('2026-01-01'),
    validUntil: null,
    maxRedemptions: null,
    redemptions: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

const PRODUCT_NAMES: Record<BookFormat, Record<Locale, string>> = {
  digital: { es: 'Libro digital (PDF)', en: 'Digital book (PDF)', pt: 'Livro digital (PDF)' },
  softcover: { es: 'Tapa blanda', en: 'Softcover', pt: 'Capa mole' },
  hardcover: { es: 'Tapa dura', en: 'Hardcover', pt: 'Capa dura' },
  booklet: { es: 'Cuento grapado', en: 'Stapled storybook', pt: 'Livro grampeado' },
};

for (const format of BOOK_FORMATS) {
  batch.set(
    db.collection(COLLECTIONS.products).doc(format),
    productSchema.parse({
      format,
      // El grapado se ofrece en los libros cortos: el precio "desde" es el del Mini (12 páginas).
      pageCount: format === 'booklet' ? 12 : 28,
      active: true,
      name: PRODUCT_NAMES[format],
      createdAt: now,
      updatedAt: now,
    }),
  );
}

batch.set(
  db.collection(COLLECTIONS.siteConfig).doc(GLOBAL_DOC_ID),
  siteConfigSchema.parse({
    mode: production ? 'preview_only' : 'live',
    updatedAt: now,
    updatedBy: 'seed',
  }),
);

batch.set(
  db.collection(COLLECTIONS.aiConfig).doc(GLOBAL_DOC_ID),
  aiConfigSchema.parse({
    // En la nube, IA real con tope bajo (aprobado para staging: USD 2 por día).
    textProvider: cloud ? 'vertex' : 'mock',
    textModel: cloud ? 'gemini-3.5-flash' : 'mock-text',
    imageProvider: cloud ? 'vertex' : 'mock',
    imageModel: cloud ? 'gemini-3.1-flash-image' : 'mock-image',
    // Estrategia comercial: 1 regeneración gratis por vista previa (configurable).
    maxRegenerationsPerBook: 1,
    maxPreviewsPerUserPerDay: cloud ? 3 : 5,
    // La portada y las páginas ilustradas piden cuenta (la etapa 1 no).
    illustrationsRequireAccount: true,
    dailyBudgetUsd: cloud ? 2 : 20,
    budgetAlertPercent: 80,
    updatedAt: now,
    updatedBy: 'seed',
  }),
);

for (const collection of SEED_COLLECTIONS) {
  batch.set(
    db.collection(COLLECTIONS.collections).doc(collection.slug),
    collectionSchema.parse({ ...collection, createdAt: now, updatedAt: now }),
  );
}

for (const story of [...SEED_STORIES, ...SEED_NEW_STORIES]) {
  batch.set(
    db.collection(COLLECTIONS.stories).doc(story.slug),
    storySchema.parse({ ...story, createdAt: now, updatedAt: now }),
  );
}

for (const lesson of SEED_LESSONS) {
  batch.set(
    db.collection(COLLECTIONS.lessons).doc(lesson.slug),
    lessonSchema.parse({
      ...lesson,
      active: true,
      sensitive: false,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

// Historias que ya no están en el catálogo de ejemplo (p. ej. las que pasaron a ser enseñanzas).
const seededSlugs = new Set([...SEED_STORIES, ...SEED_NEW_STORIES].map((story) => story.slug));
for (const doc of await db.collection(COLLECTIONS.stories).listDocuments()) {
  if (!seededSlugs.has(doc.id)) batch.delete(doc);
}

batch.set(
  db.collection(COLLECTIONS.editorialConfig).doc(GLOBAL_DOC_ID),
  editorialConfigSchema.parse(DEFAULT_EDITORIAL_CONFIG),
);

for (const { id, ...template } of SEED_ACTIVITY_TEMPLATES) {
  batch.set(
    db.collection(COLLECTIONS.activityTemplates).doc(id),
    activityTemplateSchema.parse(template),
  );
}

for (const style of SEED_STYLES) {
  batch.set(
    db.collection(COLLECTIONS.illustrationStyles).doc(style.slug),
    illustrationStyleSchema.parse({ ...style, createdAt: now, updatedAt: now }),
  );
}

/** Textos base: firebase/seed-data/content/<idioma>/<clave>.md; la primera línea "# " es el título. */
const contentDir = fileURLToPath(new URL('../seed-data/content/', import.meta.url));
const SEEDED_CONTENT = CONTENT_KEYS.filter((key) => key !== 'banner');
for (const locale of LOCALES) {
  for (const key of SEEDED_CONTENT) {
    const raw = readFileSync(`${contentDir}${locale}/${key}.md`, 'utf8');
    const [heading = '', ...rest] = raw.split('\n');
    batch.set(
      db.collection(COLLECTIONS.content).doc(contentDocId(key, locale)),
      contentSchema.parse({
        key,
        locale,
        title: heading.replace(/^#\s+/, '').trim(),
        body: rest.join('\n').trim(),
        published: true,
        updatedAt: now,
        updatedBy: 'seed',
      }),
    );
  }
}

// Con --refresh-print, los libros cortos también se ofrecen en cuento grapado (el resto de la
// configuración editorial no se toca).
if (cloud && refreshPrint) {
  await db
    .collection(COLLECTIONS.editorialConfig)
    .doc(GLOBAL_DOC_ID)
    .set(
      {
        lengths: {
          mini: { formats: DEFAULT_EDITORIAL_CONFIG.lengths.mini.formats },
          short: { formats: DEFAULT_EDITORIAL_CONFIG.lengths.short.formats },
        },
      },
      { merge: true },
    );
}

let created = 0;
const existing = cloud ? await db.getAll(...writes.map((write) => write.ref)) : [];
const commit = db.batch();
writes.forEach((write, index) => {
  const collection = write.ref.parent.id;
  const refreshable =
    (refreshCatalog && CATALOG_COLLECTIONS.has(collection)) ||
    (refreshPrint && collection === COLLECTIONS.printOptions) ||
    (collection === COLLECTIONS.content &&
      refreshContent.has((write.data as { key?: string }).key ?? ''));
  if (cloud && existing[index]?.exists && !refreshable) return;
  commit.set(write.ref, write.data);
  created += 1;
});
await commit.commit();

console.info(
  cloud
    ? `Seed en ${String(cloudProject)}: ${String(created)} documentos escritos (${refreshCatalog ? 'catálogo actualizado; ' : ''}la configuración existente no se tocó)`
    : 'Seed listo:',
);
for (const { email, role } of cloud ? [] : USERS) console.info(`  ${email} (${role})`);
console.info(
  cloud
    ? `  países con moneda propia, márgenes de fábrica (todo en USD), imprentas solo en países verificados, sitio ${production ? 'en solo vista previa' : 'en vivo'}, IA en Vertex con tope diario de USD 2`
    : '  países con moneda propia, márgenes de fábrica (todo en USD), tipo de cambio fijo, sitio en vivo, IA en mock',
);
console.info(
  `  ${String(SEED_STORIES.length + SEED_NEW_STORIES.length)} historias, ${String(SEED_COLLECTIONS.length)} colecciones, ${String(SEED_LESSONS.length)} enseñanzas, ${String(SEED_STYLES.length)} estilos, ${String(SEED_ACTIVITY_TEMPLATES.length)} actividades, configuración editorial, textos legales y FAQ en ${LOCALES.join(', ')}`,
);
