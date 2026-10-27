/** Nombres de colecciones de Firestore. Mantener sincronizado con firebase/firestore.rules. */
export const COLLECTIONS = {
  users: 'users',
  children: 'children',
  photos: 'photos',
  consents: 'consents',
  stories: 'stories',
  illustrationStyles: 'illustrationStyles',
  lessons: 'lessons',
  /** Colecciones editoriales por línea comercial. */
  collections: 'collections',
  books: 'books',
  orders: 'orders',
  orderSteps: 'steps',
  /** orders/{orderId}/events/{requestId}: eventos del pipeline ya procesados (deduplicación). */
  orderEvents: 'events',
  /** orders/{orderId}/steps/generate_illustrations/pages/{index}. */
  illustrationTasks: 'pages',
  /** adminAlerts/{id}: avisos para el admin (solo servidor). */
  adminAlerts: 'adminAlerts',
  /** books/{bookId}/qaEvents: controles de calidad del libro (solo servidor). */
  qaEvents: 'qaEvents',
  countries: 'countries',
  products: 'products',
  prices: 'prices',
  coupons: 'coupons',
  promotions: 'promotions',
  siteConfig: 'siteConfig',
  aiConfig: 'aiConfig',
  /** editorialConfig/global: extensiones, densidades, niveles y tipos de contenido. */
  editorialConfig: 'editorialConfig',
  activityTemplates: 'activityTemplates',
  aiUsage: 'aiUsage',
  aiBudget: 'aiBudget',
  /** previewQuota/{uid_AAAA-MM-DD} y previewQuota/ip_{ip}_{AAAA-MM-DD}: vistas previas del día. */
  previewQuota: 'previewQuota',
  content: 'content',
  auditLog: 'auditLog',
} as const;

/** Documento único de las colecciones de configuración global. */
export const GLOBAL_DOC_ID = 'global';
