import { z } from 'zod';

import { bookEventSchema } from './events';

import { countryCodeSchema, countryDefaults, type CountryCode } from '../countries';
import { currencySchema } from '../currency';
import { localeSchema } from '../i18n';
import { orderStatusSchema } from '../order-status';
import { avatarSchema, characterModeSchema, memoriesSchema } from './character';
import { characterTraitsSchema, mustKeepSchema } from './character';
import { channelSchema } from './channels';
import { orderPipelineSchema } from './pipeline';
import { priceSnapshotSchema } from './pricing';
import { STORY_STRUCTURES } from '../providers/ai';
import {
  ageBandSchema,
  bookLengthSchema,
  contentTypeSchema,
  readingLevelSchema,
  textDensitySchema,
} from './editorial';
import { CHILD_LIMITS } from './users';
import { bookFormatSchema, timestampsSchema, uidSchema } from './common';

/** countries/{countryCode}: configuración comercial por país (editable en el admin). */
export const countrySchema = z.object({
  code: countryCodeSchema,
  active: z.boolean(),
  formats: z.object({
    digital: z.boolean(),
    softcover: z.boolean(),
    hardcover: z.boolean(),
    // Los países anteriores al cuento grapado no lo guardan: se vende (la imprenta decide).
    booklet: z.boolean().default(true),
  }),
  currency: currencySchema,
  defaultLocale: localeSchema,
  /** Impuesto en puntos básicos (1600 = 16 %). */
  taxBasisPoints: z.number().int().min(0).max(10000),
  taxIncludedInPrice: z.boolean(),
  shipping: z.object({
    costMinor: z.number().int().nonnegative(),
    etaDaysMin: z.number().int().nonnegative(),
    etaDaysMax: z.number().int().nonnegative(),
  }),
  updatedAt: z.date(),
});

export type CountryConfig = z.infer<typeof countrySchema>;

/**
 * Un país sin configuración propia: se vende todo, en su moneda o en dólares, sin impuesto
 * propio (el envío se cotiza con cada pedido). El admin lo puede pisar en Países.
 */
export function defaultCountryConfig(code: CountryCode, now = new Date()): CountryConfig {
  const defaults = countryDefaults(code);
  return {
    code,
    active: true,
    formats: { digital: true, softcover: true, hardcover: true, booklet: true },
    currency: defaults.currency,
    defaultLocale: defaults.defaultLocale,
    taxBasisPoints: 0,
    taxIncludedInPrice: false,
    shipping: { costMinor: 0, etaDaysMin: 0, etaDaysMax: 0 },
    updatedAt: now,
  };
}

/** prices/{country}_{format} */
export const priceSchema = z.object({
  country: countryCodeSchema,
  format: bookFormatSchema,
  currency: currencySchema,
  amountMinor: z.number().int().nonnegative(),
  /** Ajuste por extensión del libro (Mini más barato, Gran aventura más caro). */
  lengthAdjustmentsMinor: z.partialRecord(bookLengthSchema, z.number().int()).default({}),
  /** Precio Pro base (cuentas profesionales); sin él, el de Familias. */
  proAmountMinor: z.number().int().nonnegative().optional(),
  active: z.boolean(),
  updatedAt: z.date(),
});

export type Price = z.infer<typeof priceSchema>;

export function priceDocId(country: string, format: string): string {
  return `${country}_${format}`;
}

/** coupons/{CODE}: solo admin; el cliente valida cupones vía API. */
export const couponSchema = timestampsSchema.extend({
  code: z.string().regex(/^[A-Z0-9_-]{3,32}$/),
  type: z.enum(['percent', 'fixed']),
  /** Porcentaje (1-100) o monto fijo en unidad mínima. */
  value: z.number().int().positive(),
  currency: currencySchema.nullable(),
  countries: z.array(countryCodeSchema),
  validFrom: z.date(),
  validUntil: z.date().nullable(),
  maxRedemptions: z.number().int().positive().nullable(),
  redemptions: z.number().int().nonnegative(),
  active: z.boolean(),
});

export type Coupon = z.infer<typeof couponSchema>;

/** promotions/{promotionId} */
export const promotionSchema = timestampsSchema.extend({
  name: z.string().min(1),
  discountPercent: z.number().int().min(1).max(100),
  countries: z.array(countryCodeSchema),
  formats: z.array(bookFormatSchema),
  startsAt: z.date(),
  endsAt: z.date(),
  active: z.boolean(),
});

export type Promotion = z.infer<typeof promotionSchema>;

/**
 * `preview_queued`: sin cupo de IA en este momento, la muestra (o sus ilustraciones) espera en la
 * fila y la genera el trabajo programado apenas haya cupo (el cliente no ve ningún límite).
 */
export const BOOK_STATUSES = [
  'draft',
  'preview_queued',
  'preview_generating',
  'preview_ready',
  'ordered',
] as const;

export const bookStatusSchema = z.enum(BOOK_STATUSES);

/** Campos de un libro que el cliente puede editar mientras es borrador. */
export const BOOK_CLIENT_EDITABLE_FIELDS = [
  'childId',
  'storyId',
  'styleId',
  'lessonIds',
  'customLesson',
  'language',
  'dedication',
  'wizardStep',
  'wizardStepKey',
  'photoIds',
  'characterMode',
  'avatar',
  'memories',
  'length',
  'textDensity',
  'readingLevel',
  'contentType',
  'updatedAt',
] as const;

export const bookPageSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  /** Escena para ilustrar (en inglés). */
  illustrationPrompt: z.string(),
  /** Ilustración limpia en el bucket de assets (solo servidor; se entrega al comprar). */
  imagePath: z.string().nullable(),
  /** Versión con marca de agua que ve el cliente en la vista previa. */
  previewImagePath: z.string().nullable(),
});

export type BookPage = z.infer<typeof bookPageSchema>;

/** Páginas ilustradas en la vista previa gratis (además de la portada). */
export const PREVIEW_ILLUSTRATED_PAGES = 2;

/** Vista previa: texto completo del cuento, portada y las primeras páginas ilustradas. */
export const bookPreviewSchema = z.object({
  title: z.string(),
  /**
   * Etapa: primero se aprueba el personaje ("character"); recién después se ilustran la
   * portada y las primeras páginas ("complete"). Las muestras anteriores son "complete".
   */
  stage: z.enum(['character', 'complete']).optional(),
  /** null mientras el personaje no está aprobado. */
  cover: z.object({ imagePath: z.string(), previewImagePath: z.string() }).nullable(),
  /** Lámina del personaje con su versión de vista previa y los rasgos confirmados. */
  character: z
    .object({
      imagePath: z.string(),
      previewImagePath: z.string(),
      traits: characterTraitsSchema,
      mustKeep: mustKeepSchema,
      approvedAt: z.date().nullable(),
      /** La lámina es el dibujo aprobado en el perfil (copiado): no se vuelve a aprobar. */
      fromDrawing: z.boolean().optional(),
      /** La foto parece de otra edad que la del cuento: se avisa antes de pagar (no bloquea). */
      ageMismatch: z.object({ apparent: z.string(), entered: z.number() }).optional(),
    })
    .optional(),
  /** Lámina del acompañante (abuela, mascota): segunda referencia de cada ilustración. */
  companion: z
    .object({ name: z.string(), look: z.string(), imagePath: z.string() })
    .nullable()
    .optional(),
  /** Lámina del personaje (referencia interna de cada ilustración; el cliente no la ve). */
  characterImagePath: z.string().nullable().optional(),
  pages: z.array(bookPageSchema),
  /** Con qué se generó, para saber si quedó desactualizada tras editar el borrador. */
  storyId: z.string(),
  styleId: z.string(),
  /** ID de la foto usada, o la clave de los rasgos en el modo sin foto (avatarKey). */
  photoId: z.string(),
  /** Opciones editoriales con las que se generó ("extensión|densidad|nivel|tipo"). */
  editorialKey: z.string().optional(),
  /** Páginas interiores del libro terminado según esas opciones. */
  interiorPages: z.number().int().positive().optional(),
  /** Dirección de arte con la que se ilustró (se congela: el libro sale igual que la muestra). */
  artDirection: z.string().nullable().optional(),
  /** Páginas de actividades y rango de palabras con que se escribió (los usa el pipeline). */
  activityPages: z.number().int().nonnegative().optional(),
  words: z
    .object({ min: z.number().int(), max: z.number().int(), cap: z.number().int().optional() })
    .optional(),
  /**
   * Franja de edad del lector y del texto (tipografía por edad). Faltan en las muestras anteriores:
   * esos libros se arman como siempre.
   */
  ageBand: ageBandSchema.optional(),
  textBand: ageBandSchema.optional(),
  /**
   * Armado por edad (page-layout.ts): con `facing`, cada escena es página de texto + ilustración.
   * Ausente en las muestras anteriores (siguen con el panel sobre la ilustración).
   */
  pageLayout: z.object({ facing: z.boolean(), age: z.number() }).nullable().optional(),
  /** Plan del planificador editorial: qué se ve y qué no en cada página (fase 09). */
  plan: z
    .object({
      theme: z.string(),
      arc: z.string(),
      structure: z.enum(STORY_STRUCTURES).nullable().optional(),
      refrain: z.string().nullable().optional(),
      companion: z.object({ name: z.string(), look: z.string() }).nullable().optional(),
      scenes: z.array(
        z.object({
          pageIndex: z.number().int().nonnegative(),
          sceneGoal: z.string(),
          emotionalBeat: z.string(),
          mustBeVisible: z.array(z.string()),
          notVisible: z.array(z.string()),
          continuityFacts: z.array(z.string()),
          wordBudget: z.number().int(),
          personalDetail: z.string().nullable(),
          wordless: z.boolean().optional(),
        }),
      ),
    })
    .nullable()
    .optional(),
  generatedAt: z.date(),
});

export type BookPreview = z.infer<typeof bookPreviewSchema>;

/** books/{bookId}: borrador del wizard y libro generado. */
export const bookSchema = timestampsSchema
  .extend({
    ownerUid: uidSchema,
    status: bookStatusSchema,
    childId: z.string().nullable(),
    storyId: z.string().nullable(),
    styleId: z.string().nullable(),
    /** Enseñanzas elegidas (lessons), en orden de importancia. Junto con el mensaje propio, hasta CHILD_LIMITS.maxLessons. */
    lessonIds: z.array(z.string()).max(CHILD_LIMITS.maxLessons),
    /** Mensaje propio del adulto, moderado antes de usarse. */
    customLesson: z.string().trim().max(CHILD_LIMITS.customLessonMaxLength).nullable(),
    language: localeSchema,
    dedication: z.string().max(CHILD_LIMITS.dedicationMaxLength).nullable(),
    wizardStep: z.number().int().min(0).max(10),
    /** Paso alcanzado, por nombre (DECISIONS 113). Sin él, se traduce `wizardStep`. */
    wizardStepKey: z.string().max(20).nullable().optional(),
    photoIds: z.array(z.string()).max(3),
    /** Con su foto o sin foto (rasgos elegidos). Los borradores anteriores no lo tienen: foto. */
    characterMode: characterModeSchema.default('photo'),
    /** Rasgos del modo sin foto. */
    avatar: avatarSchema.nullable().default(null),
    /**
     * Personaje con dibujo aprobado en su perfil: la lámina del cuento es ese dibujo (no se
     * genera otra). Sus fotos o rasgos siguen describiéndolo para las ilustraciones.
     */
    useDrawing: z.boolean().optional(),
    /** Recuerdos guiados (opcionales), moderados antes de usarse. */
    memories: memoriesSchema.nullable().default(null),
    /**
     * Opciones editoriales (fase 07b). `length` null = libro anterior: usa el pageCount de su
     * historia. Densidad, nivel y tipo tienen valores por defecto para lo anterior.
     */
    length: bookLengthSchema.nullable().default(null),
    textDensity: textDensitySchema.default('balanced'),
    readingLevel: readingLevelSchema.default('developing'),
    contentType: contentTypeSchema.default('story'),
    /** Línea comercial por la que se creó (lo anterior es de Familias). */
    channel: channelSchema.default('families'),
    /** Eventos (fase 12b): cumpleaños con fecha, edad que cumple y temática. */
    event: bookEventSchema.nullable().default(null),
    /**
     * Profesionales (fase 12c): objetivo general elegido de la colección (por ejemplo
     * "reconocer emociones"). Guía la historia; nunca es una intervención clínica.
     */
    goal: z.string().trim().max(80).nullable().default(null),
    /** Solo servidor. */
    preview: bookPreviewSchema.nullable(),
    /** Solo servidor. */
    regenerationsUsed: z.number().int().nonnegative(),
    /** Solo servidor: motivo legible del último intento fallido de vista previa. */
    previewError: z.string().nullable().optional(),
    /** Solo servidor: inicio de la generación en curso (para destrabar intentos colgados). */
    previewStartedAt: z.date().nullable().optional(),
    /** Solo servidor: rasgos confirmados por el adulto (sobreviven a una nueva muestra). */
    characterTraits: characterTraitsSchema.nullable().optional(),
    mustKeep: mustKeepSchema.optional(),
    /** Foto o rasgos sobre los que se confirmaron los rasgos: si cambian, dejan de valer. */
    characterBase: z.string().nullable().optional(),
    /** Solo servidor: costo de IA acumulado del libro, en millonésimas de dólar. */
    aiCostUsdMicros: z.number().int().nonnegative().optional(),
  })
  .refine(
    (book) => book.lessonIds.length + (book.customLesson ? 1 : 0) <= CHILD_LIMITS.maxLessons,
    {
      message: `Hasta ${String(CHILD_LIMITS.maxLessons)} enseñanzas (el mensaje propio cuenta como una)`,
    },
  );

export type Book = z.infer<typeof bookSchema>;

const moneyBreakdownSchema = z.object({
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  shippingMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
});

export const addressSchema = z.object({
  name: z.string().min(1).max(100),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullable(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).nullable(),
  postalCode: z.string().min(1).max(20),
  country: countryCodeSchema,
  phone: z.string().max(30).nullable(),
  /** Documento fiscal del destinatario (RFC, CUIT, CPF). Opcional: habilita a Lulu en México, Argentina y Brasil. */
  taxId: z.string().trim().max(30).nullable().default(null),
  /** Lugar de Google que eligió quien compra en el autocompletado (se puede guardar sin límite). */
  placeId: z.string().max(300).nullable().optional(),
  /**
   * Dónde dejó el pin quien compra, solo si lo movió (es un dato suyo, no de Google). La imprenta
   * no lo recibe: sirve para revisar la dirección y para soporte si el envío vuelve.
   */
  pin: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
});

export type Address = z.infer<typeof addressSchema>;

/** Reglas de dirección por país (lo que piden las imprentas y los correos). */
const ADDRESS_RULES: Partial<Record<string, { postalCode: RegExp; state: RegExp }>> = {
  MX: { postalCode: /^\d{5}$/, state: /^.{2,}$/ },
  US: { postalCode: /^\d{5}(-\d{4})?$/, state: /^[A-Z]{2}$/ },
  // CPA (C1425ABC), solo letra y número (C1425) o el código viejo de 4 dígitos.
  AR: { postalCode: /^([A-Z]\d{4}([A-Z]{3})?|\d{4})$/, state: /^.*$/ },
  UY: { postalCode: /^\d{5}$/, state: /^.*$/ },
  // Gelato exige el estado (o la región) en Brasil y Chile.
  BR: { postalCode: /^\d{5}-?\d{3}$/, state: /^.{2,}$/ },
  CL: { postalCode: /^\d{7}$/, state: /^.{2,}$/ },
  CO: { postalCode: /^\d{6}$/, state: /^.*$/ },
  PE: { postalCode: /^\d{5}$/, state: /^.*$/ },
  EC: { postalCode: /^\d{6}$/, state: /^.*$/ },
  ES: { postalCode: /^\d{5}$/, state: /^.*$/ },
};

/** Países donde la imprenta o el correo exigen el estado, la región o la provincia. */
export const STATE_REQUIRED_COUNTRIES = ['MX', 'US', 'BR', 'CL'] as const;

/** Un código postal de ejemplo por país, para el mensaje de error. */
export const POSTAL_CODE_EXAMPLES: Partial<Record<string, string>> = {
  MX: '06600',
  US: '78701',
  AR: 'C1425ABC',
  UY: '11300',
  BR: '01310-100',
  CL: '7500000',
  CO: '110111',
  PE: '15046',
  EC: '170150',
  ES: '28013',
};

/**
 * Países donde se pide el documento de quien recibe. La aduana lo exige para entregar envíos
 * del exterior (lista de Lulu: México RFC, Argentina CUIT o CUIL, Brasil CPF, Chile RUT, Perú
 * DNI o RUC, Ecuador cédula o RUC); sin él, el paquete puede volver al origen. En Uruguay es opcional.
 */
export const TAX_ID_COUNTRIES = ['MX', 'AR', 'BR', 'CL', 'PE', 'EC', 'UY'] as const;
export const TAX_ID_REQUIRED_COUNTRIES = ['MX', 'AR', 'BR', 'CL', 'PE', 'EC'] as const;

const digits = (value: string) => value.replace(/[\s.\-/]/g, '');

/** CUIT o CUIL: 11 dígitos con dígito verificador (módulo 11). */
function validCuit(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(value[index]), 0);
  const check = 11 - (sum % 11);
  const expected = check === 11 ? 0 : check === 10 ? 9 : check;
  return expected === Number(value[10]);
}

/** CPF: 11 dígitos con dos verificadores; un CNPJ (14 dígitos, empresas) se acepta tal cual. */
function validCpf(value: string): boolean {
  if (/^\d{14}$/.test(value)) return true;
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(value[9]) && check(10) === Number(value[10]);
}

/** RUT: 7 u 8 dígitos y un verificador (0 a 9 o K, módulo 11). */
function validRut(value: string): boolean {
  const match = /^(\d{7,8})([\dK])$/.exec(value.toUpperCase());
  if (!match) return false;
  const [, body = '', dv] = match;
  let sum = 0;
  let factor = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? '0' : rest === 10 ? 'K' : String(rest);
  return expected === dv;
}

/** Cédula de Ecuador: 10 dígitos, provincia 01 a 24 (o 30) y verificador módulo 10. */
function validCedulaEc(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if ((province < 1 || province > 24) && province !== 30) return false;
  if (Number(value[2]) > 5) return false;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    let product = Number(value[index]) * (index % 2 === 0 ? 2 : 1);
    if (product > 9) product -= 9;
    sum += product;
  }
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}

/** Cómo se valida el documento en cada país (sin puntos, guiones ni espacios). */
const TAX_ID_RULES: Partial<Record<string, (value: string) => boolean>> = {
  // RFC: 12 caracteres (empresas) o 13 (personas). Lulu no acepta la CURP.
  MX: (value) => /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(value.toUpperCase()),
  AR: validCuit,
  BR: validCpf,
  CL: validRut,
  // DNI (8 dígitos) o RUC (11).
  PE: (value) => /^(\d{8}|\d{11})$/.test(value),
  // Cédula (10 dígitos con verificador) o RUC (13: empresas y personas con actividad).
  EC: (value) => validCedulaEc(value) || /^\d{13}$/.test(value),
  // Cédula: 6 a 8 dígitos.
  UY: (value) => /^\d{6,8}$/.test(value),
};

/** Campos de la dirección que no cumplen las reglas de su país (vacío si está bien). */
export function addressProblems(address: Address): (keyof Address)[] {
  const problems: (keyof Address)[] = [];
  const taxId = address.taxId?.trim() ?? '';
  const taxRule = TAX_ID_RULES[address.country];
  if (taxId) {
    // Fuera de los países con regla propia, solo tiene que parecerse a un documento.
    const valid = taxRule ? taxRule(digits(taxId)) : /^[A-Za-z0-9.\-/]{5,20}$/.test(taxId);
    if (!valid) problems.push('taxId');
  } else if ((TAX_ID_REQUIRED_COUNTRIES as readonly string[]).includes(address.country)) {
    problems.push('taxId');
  }
  // El teléfono lo pide la imprenta en todos los países (Cloudprinter rechaza el pedido sin él).
  if (!/^[+\d][\d\s()-]{6,}$/.test((address.phone ?? '').trim())) problems.push('phone');
  const rules = ADDRESS_RULES[address.country];
  if (!rules) return problems;
  const postalCode = address.postalCode.replace(/\s+/g, '').toUpperCase();
  if (!rules.postalCode.test(postalCode)) problems.push('postalCode');
  if (!rules.state.test((address.state ?? '').trim().toUpperCase())) problems.push('state');
  return problems;
}

export const ORDER_PIECES = ['book', 'invitation', 'thank_you'] as const;

/** Una línea del pedido: pieza, formato y cantidad. */
export const orderItemSchema = z.object({
  piece: z.enum(ORDER_PIECES).default('book'),
  // Las tarjetas impresas del kit son un pedido aparte con formato "card".
  format: bookFormatSchema.or(z.literal('card')),
  quantity: z.number().int().min(1).max(500),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

/** orders/{orderId}: solo servidor (precios, estado y costos nunca los escribe el cliente). */
export const orderSchema = timestampsSchema.extend({
  ownerUid: uidSchema,
  bookId: z.string().min(1),
  status: orderStatusSchema,
  /** Línea comercial del pedido (los pedidos anteriores son de Familias). */
  channel: channelSchema.default('families'),
  /** Líneas del pedido: todas salen de un solo diseño (Eventos imprime N copias). */
  items: z.array(orderItemSchema).min(1),
  country: countryCodeSchema,
  currency: currencySchema,
  amounts: moneyBreakdownSchema,
  couponCode: z.string().nullable(),
  gift: z.object({ isGift: z.boolean(), message: z.string().max(500).nullable() }),
  shippingAddress: addressSchema.nullable(),
  payment: z.object({
    provider: z.string(),
    checkoutSessionId: z.string().nullable(),
    paymentId: z.string().nullable(),
  }),
  print: z
    .object({
      provider: z.string(),
      externalOrderId: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      trackingUrl: z.url().nullable(),
    })
    .nullable(),
  /** Costos reales en millonésimas de dólar para el cálculo de margen. */
  costsUsdMicros: z.object({
    ai: z.number().int().nonnegative(),
    print: z.number().int().nonnegative(),
    shipping: z.number().int().nonnegative(),
  }),
  /** Precio congelado: componentes, descuento y su motivo, envío e impuestos. */
  priceSnapshot: priceSnapshotSchema.nullable().default(null),
  /** Lo que el comprador aprobó y pagó (huella de la vista previa; sin datos del niño). */
  approval: z
    .object({ fingerprint: z.string(), approvedAt: z.date().nullable() })
    .nullable()
    .default(null),
  /** Consentimiento de analítica al pagar (para las conversiones del lado del servidor). */
  analyticsConsent: z.boolean().default(false),
  pipeline: orderPipelineSchema.default({
    generation: 0,
    runId: null,
    startedAt: null,
    finishedAt: null,
    failedStep: null,
    error: null,
  }),
});

export type Order = z.infer<typeof orderSchema>;

/** Rutas de las imágenes de la vista previa guardadas en un libro (para borrarlas). */
export function previewPaths(preview: unknown): string[] {
  if (!preview || typeof preview !== 'object') return [];
  const value = preview as {
    character?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    companion?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    cover?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    pages?: { imagePath?: unknown; previewImagePath?: unknown }[];
  };
  return [value.character, value.companion, value.cover, ...(value.pages ?? [])].flatMap((item) =>
    [item?.imagePath, item?.previewImagePath].filter(
      (path): path is string => typeof path === 'string',
    ),
  );
}
