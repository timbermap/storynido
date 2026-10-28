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
  COUNTRY_CODES,
  COUNTRY_DEFAULTS,
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
  priceDocId,
  priceSchema,
  productSchema,
  siteConfigSchema,
  storySchema,
  userSchema,
  type BookFormat,
  PRINT_FORMATS,
  CLOUDPRINTER_PRODUCTS,
  DEFAULT_PRO_DISCOUNTS,
  GELATO_PRODUCTS,
  LULU_PRODUCTS,
  proDiscountConfigSchema,
  eventPricingSchema,
  printOptionId,
  printOptionSchema,
  type BookLength,
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
/** En la nube, `--refresh-catalog` reescribe historias, estilos y enseñanzas (no la configuración). */
const refreshCatalog = process.argv.includes('--refresh-catalog');
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

/** Precios de ejemplo para desarrollo (los reales se cargan desde el admin). */
const SAMPLE_PRICES: Partial<Record<CountryCode, Record<BookFormat, number>>> = {
  MX: { digital: 34900, softcover: 79900, hardcover: 99900 },
  US: { digital: 1999, softcover: 3999, hardcover: 4999 },
};

/** Ajuste por extensión: el Mini cuesta menos y la Gran aventura más. */
const SAMPLE_LENGTH_ADJUSTMENTS: Partial<Record<CountryCode, Partial<Record<BookLength, number>>>> =
  {
    MX: { mini: -5000, epic: 10000 },
    US: { mini: -300, epic: 600 },
  };

const SAMPLE_SHIPPING: Partial<
  Record<CountryCode, { costMinor: number; etaDaysMin: number; etaDaysMax: number }>
> = {
  MX: { costMinor: 9900, etaDaysMin: 5, etaDaysMax: 9 },
  US: { costMinor: 699, etaDaysMin: 4, etaDaysMax: 8 },
};

const writes: { ref: DocumentReference; data: object }[] = [];
/** En la nube solo se crean los documentos que faltan; en los emuladores se reescriben. */
const batch = {
  set(ref: DocumentReference, data: object) {
    writes.push({ ref, data });
  },
  delete(ref: DocumentReference) {
    if (!cloud) void ref.delete();
  },
};

for (const code of COUNTRY_CODES) {
  const defaults = COUNTRY_DEFAULTS[code];
  const launched = defaults.launchPhase === 1;
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

  const prices = SAMPLE_PRICES[code];
  if (!prices) continue;
  for (const format of BOOK_FORMATS) {
    batch.set(
      db.collection(COLLECTIONS.prices).doc(priceDocId(code, format)),
      priceSchema.parse({
        country: code,
        format,
        currency: defaults.currency,
        amountMinor: prices[format],
        // Precio Pro base de ejemplo: 10 % menos (editable en el admin).
        proAmountMinor: Math.round((prices[format] * 0.9) / 100) * 100 - (code === 'US' ? 1 : 0),
        lengthAdjustmentsMinor: SAMPLE_LENGTH_ADJUSTMENTS[code] ?? {},
        active: true,
        updatedAt: now,
      }),
    );
  }
}

// Matriz de impresión de ejemplo con la imprenta simulada (la real se habilita desde el admin
// recién con la muestra física aprobada).
const SAMPLE_PRINT: Partial<Record<CountryCode, { etaDaysMin: number; etaDaysMax: number }>> = {
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
          pages: { min: format === 'hardcover' ? 20 : 12, max: 120, multipleOf: 2 },
          maxQuantity: 100,
          ...eta,
          productionCostUsdMinor:
            (format === 'hardcover' ? 1400 : 900) + (provider === 'mock_alt' ? 150 : 0),
          updatedAt: now,
        }),
      );
    }
  }
}

// Gelato (DECISIONS 076): solo EE. UU. (a México sale a pérdida). Fotolibros de 28 a 200
// páginas pares. Costo y plazo de referencia de su cotización; el real se pide al pagar.
for (const format of PRINT_FORMATS) {
  batch.set(
    db.collection(COLLECTIONS.printOptions).doc(printOptionId('US', format, 'gelato')),
    printOptionSchema.parse({
      country: 'US',
      format,
      provider: 'gelato',
      sku: GELATO_PRODUCTS[format],
      enabled: true,
      // En producción se habilita recién con la muestra física aprobada.
      qaSamplePassed: cloudProject !== 'storynido-prod',
      pages: { min: 28, max: 200, multipleOf: 2 },
      maxQuantity: 100,
      etaDaysMin: 6,
      etaDaysMax: 8,
      productionCostUsdMinor: format === 'hardcover' ? 1283 : 986,
      updatedAt: now,
    }),
  );
}

// Cloudprinter (DECISIONS 080): fotolibros US Letter producidos cerca del cliente. En México
// sale mucho más barato que Gelato (que imprime en EE. UU.). Costos de referencia de su
// cotización (USD); el real se pide al pagar y el enrutador elige el más barato.
const CLOUDPRINTER: Partial<
  Record<CountryCode, { eta: [number, number]; cost: Record<'softcover' | 'hardcover', number> }>
> = {
  MX: { eta: [5, 9], cost: { softcover: 523, hardcover: 1079 } },
  US: { eta: [5, 10], cost: { softcover: 1296, hardcover: 3169 } },
};
for (const [code, cloud] of Object.entries(CLOUDPRINTER) as [
  CountryCode,
  { eta: [number, number]; cost: Record<'softcover' | 'hardcover', number> },
][]) {
  for (const format of PRINT_FORMATS) {
    batch.set(
      db.collection(COLLECTIONS.printOptions).doc(printOptionId(code, format, 'cloudprinter')),
      printOptionSchema.parse({
        country: code,
        format,
        provider: 'cloudprinter',
        sku: CLOUDPRINTER_PRODUCTS[format],
        enabled: true,
        // En producción se habilita recién con la muestra física aprobada.
        qaSamplePassed: cloudProject !== 'storynido-prod',
        pages: { min: 28, max: 200, multipleOf: 2 },
        maxQuantity: 100,
        etaDaysMin: cloud.eta[0],
        etaDaysMax: cloud.eta[1],
        productionCostUsdMinor: cloud.cost[format],
        updatedAt: now,
      }),
    );
  }
}

// Lulu (EE. UU.; DECISIONS 086): la más barata en tapa blanda. Pide 32 páginas en tapa blanda: el
// libro clásico (28) se completa con páginas para dibujar. Fuera de producción usa el sandbox.
const LULU_COST: Record<'softcover' | 'hardcover', number> = { softcover: 494, hardcover: 1351 };
for (const format of PRINT_FORMATS) {
  batch.set(
    db.collection(COLLECTIONS.printOptions).doc(printOptionId('US', format, 'lulu')),
    printOptionSchema.parse({
      country: 'US',
      format,
      provider: 'lulu',
      sku: LULU_PRODUCTS[format],
      enabled: true,
      qaSamplePassed: cloudProject !== 'storynido-prod',
      pages: { min: 24, max: 200, multipleOf: 2 },
      maxQuantity: 100,
      etaDaysMin: 8,
      etaDaysMax: 16,
      productionCostUsdMinor: LULU_COST[format],
      updatedAt: now,
    }),
  );
}

// Kit de Eventos (DECISIONS 079): precios de ejemplo, editables en el admin (fase 14). El
// diseño incluye el librito; cada pieza extra es una licencia digital (las copias no cambian el
// precio: la licencia dice cuántas se pueden imprimir).
const EVENT_PRICES: Partial<
  Record<CountryCode, { design: number; pieces: Record<string, number> }>
> = {
  MX: {
    design: 24900,
    pieces: {
      activities: 4900,
      invitation: 6900,
      thank_you: 4900,
      stickers: 5900,
      favor_tags: 4900,
    },
  },
  US: {
    design: 1499,
    pieces: { activities: 299, invitation: 399, thank_you: 299, stickers: 349, favor_tags: 299 },
  },
};
for (const [code, prices] of Object.entries(EVENT_PRICES) as [
  CountryCode,
  { design: number; pieces: Record<string, number> },
][]) {
  batch.set(
    db.collection(COLLECTIONS.eventPricing).doc(code),
    eventPricingSchema.parse({
      country: code,
      currency: COUNTRY_DEFAULTS[code].currency,
      active: true,
      designMinor: prices.design,
      pieces: prices.pieces,
      updatedAt: now,
    }),
  );
}

// Descuento Pro por recurrencia (DECISIONS 081): escalones de fábrica, editables en el admin.
batch.set(
  db.collection(COLLECTIONS.proDiscounts).doc(GLOBAL_DOC_ID),
  proDiscountConfigSchema.parse(DEFAULT_PRO_DISCOUNTS),
);

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
};

for (const format of BOOK_FORMATS) {
  batch.set(
    db.collection(COLLECTIONS.products).doc(format),
    productSchema.parse({
      format,
      pageCount: 28,
      active: true,
      name: PRODUCT_NAMES[format],
      createdAt: now,
      updatedAt: now,
    }),
  );
}

batch.set(
  db.collection(COLLECTIONS.siteConfig).doc(GLOBAL_DOC_ID),
  siteConfigSchema.parse({ mode: 'live', updatedAt: now, updatedBy: 'seed' }),
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

let created = 0;
const existing = cloud ? await db.getAll(...writes.map((write) => write.ref)) : [];
const commit = db.batch();
writes.forEach((write, index) => {
  const refreshable = refreshCatalog && CATALOG_COLLECTIONS.has(write.ref.parent.id);
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
    ? '  países, precios de ejemplo, sitio en vivo, IA en Vertex con tope diario de USD 2'
    : '  países MX y US activos, precios de ejemplo, sitio en vivo, IA en mock',
);
console.info(
  `  ${String(SEED_STORIES.length + SEED_NEW_STORIES.length)} historias, ${String(SEED_COLLECTIONS.length)} colecciones, ${String(SEED_LESSONS.length)} enseñanzas, ${String(SEED_STYLES.length)} estilos, ${String(SEED_ACTIVITY_TEMPLATES.length)} actividades, configuración editorial, textos legales y FAQ en ${LOCALES.join(', ')}`,
);
