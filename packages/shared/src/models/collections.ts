/** Nombres de colecciones de Firestore. Mantener sincronizado con firebase/firestore.rules. */
export const COLLECTIONS = {
  users: 'users',
  children: 'children',
  photos: 'photos',
  consents: 'consents',
  stories: 'stories',
  illustrationStyles: 'illustrationStyles',
  books: 'books',
  orders: 'orders',
  orderSteps: 'steps',
  countries: 'countries',
  products: 'products',
  prices: 'prices',
  coupons: 'coupons',
  promotions: 'promotions',
  siteConfig: 'siteConfig',
  aiConfig: 'aiConfig',
  content: 'content',
  auditLog: 'auditLog',
} as const;

/** Documento único de las colecciones de configuración global. */
export const GLOBAL_DOC_ID = 'global';
