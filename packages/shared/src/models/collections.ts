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
  /** loginMetrics/{AAAA-MM-DD}: contadores del login por navegador, método y vía. */
  loginMetrics: 'loginMetrics',
  /** contactMessages/{id}: mensajes del formulario de contacto (solo el servidor y el admin). */
  contactMessages: 'contactMessages',
  /** contactLimits/{huella de IP y día}: tope de mensajes de contacto por conexión. */
  contactLimits: 'contactLimits',
  /** printQuoteRequests/{id}: pedidos de cotización de piezas impresas (Eventos). */
  printQuoteRequests: 'printQuoteRequests',
  /** reviews/{pedido}: opiniones de los clientes (privadas; solo el admin las lee). */
  reviews: 'reviews',
  /** emailLog/{huella de la clave}: mails enviados u omitidos (solo servidor; el admin los ve). */
  emailLog: 'emailLog',
  /** printOptions/{país}_{formato}_{imprenta}: matriz de impresión (admin). */
  printOptions: 'printOptions',
  /** books/{bookId}/qaEvents: controles de calidad del libro (solo servidor). */
  qaEvents: 'qaEvents',
  countries: 'countries',
  products: 'products',
  prices: 'prices',
  /** productPricing/{formato}: margen por producto (precio = costo + margen; DECISIONS 096). */
  productPricing: 'productPricing',
  /** proDiscounts/global: descuento Pro por recurrencia (escalones editables en el admin). */
  proDiscounts: 'proDiscounts',
  /** eventPricing/{país}: precio del kit de Eventos (diseño + licencia por pieza). */
  eventPricing: 'eventPricing',
  coupons: 'coupons',
  promotions: 'promotions',
  siteConfig: 'siteConfig',
  aiConfig: 'aiConfig',
  /** Catálogo de modelos de IA: precios y política de datos (admin, fase 14). */
  aiModels: 'aiModels',
  /** Métricas diarias precalculadas del dashboard. */
  metricsDaily: 'metricsDaily',
  /** Tipo de cambio diario a USD (fuente: open.er-api.com). */
  fxRates: 'fxRates',
  /** Constancias de los pedidos de borrado gestionados por el admin. */
  privacyRequests: 'privacyRequests',
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
