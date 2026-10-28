import { z } from 'zod';

import { currencySchema } from '../currency';
import type { CountryConfig, Coupon, Price, Promotion } from './commerce';
import type { BookFormat } from './common';
import type { BookLength } from './editorial';
import { kitPieceSchema, type EventPricing, type KitSelection } from './kit';

/** Un componente del precio (lo que el comprador ve en el resumen y queda en el pedido). */
export const priceComponentSchema = z.object({
  /** book/length: libro; design/piece: kit de Eventos (diseño una vez + licencia por pieza). */
  code: z.enum(['book', 'length', 'design', 'piece']),
  piece: kitPieceSchema.optional(),
  unitMinor: z.number().int(),
  quantity: z.number().int().positive(),
  totalMinor: z.number().int(),
});

/** Precio congelado en el pedido: cada componente, el descuento y su motivo. */
export const priceSnapshotSchema = z.object({
  currency: currencySchema,
  components: z.array(priceComponentSchema),
  subtotalMinor: z.number().int().nonnegative(),
  discount: z.object({
    minor: z.number().int().nonnegative(),
    reason: z.enum(['coupon', 'promotion', 'pro']).nullable(),
    /** Código del cupón o nombre de la promoción. */
    label: z.string().nullable(),
  }),
  shipping: z.object({
    minor: z.number().int().nonnegative(),
    etaDaysMin: z.number().int().nonnegative(),
    etaDaysMax: z.number().int().nonnegative(),
  }),
  tax: z.object({
    minor: z.number().int().nonnegative(),
    basisPoints: z.number().int(),
    included: z.boolean(),
  }),
  totalMinor: z.number().int().nonnegative(),
});

export type PriceSnapshot = z.infer<typeof priceSnapshotSchema>;

export const QUOTE_ERRORS = [
  'country_unavailable',
  'format_unavailable',
  'price_missing',
  'coupon_invalid',
  'coupon_expired',
  'coupon_exhausted',
  'coupon_not_applicable',
] as const;

export type QuoteError = (typeof QUOTE_ERRORS)[number];

/**
 * proDiscounts/global: descuento Pro por recurrencia (editable en el admin). Las compras
 * elegibles (pagadas, sin reembolso ni cancelación) se cuentan en el servidor, en la ventana.
 */
export const proDiscountConfigSchema = z.object({
  windowDays: z.number().int().min(1).max(365),
  /** Escalones: desde N compras elegibles, X % (el mayor que corresponda). */
  tiers: z.array(
    z.object({
      minPurchases: z.number().int().min(1),
      percent: z.number().int().min(0).max(80),
    }),
  ),
  /** Tope del descuento en impresos (cuida el margen; en digital rige la tabla). */
  physicalMaxPercent: z.number().int().min(0).max(80),
});

export type ProDiscountConfig = z.infer<typeof proDiscountConfigSchema>;

export const DEFAULT_PRO_DISCOUNTS: ProDiscountConfig = {
  windowDays: 90,
  tiers: [
    { minPurchases: 5, percent: 10 },
    { minPurchases: 10, percent: 15 },
    { minPurchases: 20, percent: 20 },
  ],
  physicalMaxPercent: 15,
};

/** Porcentaje Pro que corresponde a la próxima compra (las previas + esta no cuenta todavía). */
export function proPercent(
  purchases: number,
  config: ProDiscountConfig,
  format: BookFormat,
): number {
  const tier = [...config.tiers]
    .filter((item) => purchases >= item.minPurchases)
    .sort((a, b) => b.percent - a.percent)[0];
  const percent = tier?.percent ?? 0;
  return format === 'digital' ? percent : Math.min(percent, config.physicalMaxPercent);
}

export interface QuoteInput {
  country: CountryConfig | null;
  price: Price | null;
  format: BookFormat;
  length: BookLength | null;
  quantity: number;
  coupon: Coupon | null;
  /** Código que escribió el comprador (aunque no exista). */
  couponCode: string | null;
  promotions: readonly Promotion[];
  now: Date;
  /** Cuenta profesional: precio Pro base y descuento por compras elegibles previas. */
  pro?: { purchases: number; config: ProDiscountConfig } | null;
}

export type QuoteResult =
  | { ok: true; snapshot: PriceSnapshot; couponError: QuoteError | null }
  | { ok: false; error: QuoteError };

function couponProblem(
  coupon: Coupon | null,
  input: Pick<QuoteInput, 'country' | 'now'>,
): QuoteError | null {
  if (!coupon?.active) return 'coupon_invalid';
  if (coupon.validFrom > input.now || (coupon.validUntil && coupon.validUntil < input.now)) {
    return 'coupon_expired';
  }
  if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) {
    return 'coupon_exhausted';
  }
  if (
    coupon.countries.length > 0 &&
    input.country &&
    !coupon.countries.includes(input.country.code)
  ) {
    return 'coupon_not_applicable';
  }
  if (coupon.type === 'fixed' && coupon.currency !== input.country?.currency) {
    return 'coupon_not_applicable';
  }
  return null;
}

/**
 * Precio de un pedido, calculado siempre en el servidor. Se aplica un solo descuento: el
 * mayor entre el cupón y la promoción vigente. Un cupón que no sirve no frena la compra: se
 * informa (`couponError`) y se cobra sin él.
 */
export function quote(input: QuoteInput): QuoteResult {
  const { country, price, format } = input;
  if (!country?.active) return { ok: false, error: 'country_unavailable' };
  if (!country.formats[format]) return { ok: false, error: 'format_unavailable' };
  if (!price?.active || price.currency !== country.currency || price.format !== format) {
    return { ok: false, error: 'price_missing' };
  }
  const quantity = Math.max(1, Math.floor(input.quantity));
  const lengthAdjustment = input.length ? (price.lengthAdjustmentsMinor[input.length] ?? 0) : 0;
  // Profesionales: su precio base (si el país lo tiene); el resto, el de Familias.
  const unit = input.pro ? (price.proAmountMinor ?? price.amountMinor) : price.amountMinor;
  const components: PriceSnapshot['components'] = [
    {
      code: 'book',
      unitMinor: unit,
      quantity,
      totalMinor: unit * quantity,
    },
  ];
  if (lengthAdjustment !== 0) {
    components.push({
      code: 'length',
      unitMinor: lengthAdjustment,
      quantity,
      totalMinor: lengthAdjustment * quantity,
    });
  }
  return finalize(components, country, format, input);
}

/**
 * Kit de Eventos: el diseño (una vez, incluye el librito) más la licencia digital de cada
 * pieza extra. Es digital: sin envío. Descuentos e impuestos, igual que un libro.
 */
export function quoteKit(
  input: Omit<QuoteInput, 'price' | 'format' | 'length' | 'quantity'> & {
    pricing: EventPricing | null;
    kit: KitSelection;
    /** "Pedir más copias" del mismo diseño: no se vuelve a cobrar el diseño. */
    reuseDesign?: boolean;
  },
): QuoteResult {
  const { country, pricing } = input;
  if (!country?.active) return { ok: false, error: 'country_unavailable' };
  if (!pricing?.active || pricing.currency !== country.currency) {
    return { ok: false, error: 'price_missing' };
  }
  const components: PriceSnapshot['components'] = input.reuseDesign
    ? []
    : [
        {
          code: 'design',
          unitMinor: pricing.designMinor,
          quantity: 1,
          totalMinor: pricing.designMinor,
        },
      ];
  for (const { piece } of input.kit.pieces) {
    if (piece === 'mini_book') continue;
    const unit = pricing.pieces[piece];
    if (unit === undefined) return { ok: false, error: 'format_unavailable' };
    components.push({ code: 'piece', piece, unitMinor: unit, quantity: 1, totalMinor: unit });
  }
  return finalize(components, country, 'digital', input);
}

function finalize(
  components: PriceSnapshot['components'],
  country: CountryConfig,
  format: BookFormat,
  input: Pick<QuoteInput, 'coupon' | 'couponCode' | 'promotions' | 'now' | 'country' | 'pro'>,
): QuoteResult {
  const subtotal = Math.max(
    0,
    components.reduce((sum, component) => sum + component.totalMinor, 0),
  );

  // Descuentos: el mejor entre la promoción vigente y el cupón válido.
  const promotion = input.promotions
    .filter(
      (item) =>
        item.active &&
        item.startsAt <= input.now &&
        item.endsAt >= input.now &&
        (item.countries.length === 0 || item.countries.includes(country.code)) &&
        (item.formats.length === 0 || item.formats.includes(format)),
    )
    .sort((a, b) => b.discountPercent - a.discountPercent)[0];
  const promotionMinor = promotion ? Math.round((subtotal * promotion.discountPercent) / 100) : 0;
  const couponError = input.couponCode ? couponProblem(input.coupon, input) : null;
  const coupon = input.couponCode && !couponError ? input.coupon : null;
  const couponMinor = coupon
    ? Math.min(
        subtotal,
        coupon.type === 'percent' ? Math.round((subtotal * coupon.value) / 100) : coupon.value,
      )
    : 0;
  // Profesionales: descuento por recurrencia (un solo descuento: el mayor de todos).
  const percentPro = input.pro ? proPercent(input.pro.purchases, input.pro.config, format) : 0;
  const proMinor = Math.round((subtotal * percentPro) / 100);
  const best = Math.max(couponMinor, promotionMinor, proMinor);
  const discount =
    best === 0
      ? { minor: 0, reason: null, label: null }
      : couponMinor === best
        ? { minor: couponMinor, reason: 'coupon' as const, label: coupon?.code ?? null }
        : proMinor === best
          ? { minor: proMinor, reason: 'pro' as const, label: `Pro ${String(percentPro)} %` }
          : { minor: promotionMinor, reason: 'promotion' as const, label: promotion?.name ?? null };

  const shippingMinor = format === 'digital' ? 0 : country.shipping.costMinor;
  const taxable = subtotal - discount.minor + shippingMinor;
  const basisPoints = country.taxBasisPoints;
  // Incluido: el precio ya lo tiene y se informa la parte que corresponde; si no, se suma.
  const taxMinor = country.taxIncludedInPrice
    ? Math.round((taxable * basisPoints) / (10000 + basisPoints))
    : Math.round((taxable * basisPoints) / 10000);
  const total = taxable + (country.taxIncludedInPrice ? 0 : taxMinor);

  return {
    ok: true,
    couponError,
    snapshot: {
      currency: country.currency,
      components,
      subtotalMinor: subtotal,
      discount,
      shipping: {
        minor: shippingMinor,
        etaDaysMin: format === 'digital' ? 0 : country.shipping.etaDaysMin,
        etaDaysMax: format === 'digital' ? 0 : country.shipping.etaDaysMax,
      },
      tax: { minor: taxMinor, basisPoints, included: country.taxIncludedInPrice },
      totalMinor: total,
    },
  };
}
