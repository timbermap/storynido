/**
 * Datos de desarrollo para los emuladores: usuarios de prueba con roles,
 * configuración de países, productos, precios, sitio e IA.
 * Se niega a correr fuera de los emuladores.
 */
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import {
  BOOK_FORMATS,
  COLLECTIONS,
  COUNTRY_CODES,
  COUNTRY_DEFAULTS,
  GLOBAL_DOC_ID,
  aiConfigSchema,
  countrySchema,
  priceDocId,
  priceSchema,
  productSchema,
  siteConfigSchema,
  userSchema,
  type BookFormat,
  type CountryCode,
  type Role,
} from '@storynido/shared';

import { initAdmin, isUsingEmulators } from './admin';

if (!isUsingEmulators()) {
  console.error(
    'El seed solo corre contra los emuladores (FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST).',
  );
  process.exit(1);
}

const app = initAdmin(undefined);
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

for (const { email, displayName, role } of USERS) {
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
        locale: 'es-mx',
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

const batch = db.batch();

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
      defaultLanguage: defaults.defaultLanguage,
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

const PRODUCT_NAMES: Record<BookFormat, { es: string; en: string; 'pt-BR': string }> = {
  digital: { es: 'Libro digital (PDF)', en: 'Digital book (PDF)', 'pt-BR': 'Livro digital (PDF)' },
  softcover: { es: 'Tapa blanda', en: 'Softcover', 'pt-BR': 'Capa mole' },
  hardcover: { es: 'Tapa dura', en: 'Hardcover', 'pt-BR': 'Capa dura' },
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
    textProvider: 'mock',
    textModel: 'mock-text',
    imageProvider: 'mock',
    imageModel: 'mock-image',
    maxRegenerationsPerBook: 3,
    dailyBudgetUsd: 20,
    budgetAlertPercent: 80,
    updatedAt: now,
    updatedBy: 'seed',
  }),
);

await batch.commit();

console.info('Seed listo:');
for (const { email, role } of USERS) console.info(`  ${email} (${role})`);
console.info('  países MX y US activos, precios de ejemplo, sitio en vivo, IA en mock');
