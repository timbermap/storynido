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
  type CountryCode,
  type Locale,
  type Role,
} from '@storynido/shared';

import { SEED_ACTIVITY_TEMPLATES, SEED_STORIES, SEED_STYLES } from '../seed-data/catalog';
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
        active: true,
        updatedAt: now,
      }),
    );
  }
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
      pageCount: 24,
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
    dailyBudgetUsd: cloud ? 2 : 20,
    budgetAlertPercent: 80,
    updatedAt: now,
    updatedBy: 'seed',
  }),
);

for (const story of SEED_STORIES) {
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
const seededSlugs = new Set(SEED_STORIES.map((story) => story.slug));
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
  if (cloud && existing[index]?.exists) return;
  commit.set(write.ref, write.data);
  created += 1;
});
await commit.commit();

console.info(
  cloud
    ? `Seed en ${String(cloudProject)}: ${String(created)} documentos nuevos (los existentes no se tocaron)`
    : 'Seed listo:',
);
for (const { email, role } of cloud ? [] : USERS) console.info(`  ${email} (${role})`);
console.info(
  cloud
    ? '  países, precios de ejemplo, sitio en vivo, IA en Vertex con tope diario de USD 2'
    : '  países MX y US activos, precios de ejemplo, sitio en vivo, IA en mock',
);
console.info(
  `  ${String(SEED_STORIES.length)} historias, ${String(SEED_LESSONS.length)} enseñanzas, ${String(SEED_STYLES.length)} estilos, ${String(SEED_ACTIVITY_TEMPLATES.length)} actividades, configuración editorial, textos legales y FAQ en ${LOCALES.join(', ')}`,
);
