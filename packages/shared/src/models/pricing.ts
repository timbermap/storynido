import { z } from 'zod';

import { currencySchema, type Currency } from '../currency';
import type { CountryConfig, Coupon, Promotion } from './commerce';
import type { BookFormat } from './common';
import { bookFloorMinor, bookPriceMinor } from './book-price';
import { kitPieceSchema, type EventPricing, type KitSelection } from './kit';
import type { FxRates } from './metrics';
import {
  charmPrice,
  fromUsdMinor,
  marginUsdMinor,
  paymentFeePercent,
  unitPriceUsdMinor,
  withPaymentFee,
  type Margin,
  type ProductPricing,
} from './product-pricing';

/**
 * Todo se cobra en dólares (decisión de Sebastián, DECISIONS 097): precios, pedidos, cupones
 * fijos y el kit de Eventos. La moneda local de cada país es solo una referencia ("≈ MXN 373").
 */
export const CHARGE_CURRENCY: Currency = 'USD';

/** Un componente del precio (lo que el comprador ve en el resumen y queda en el pedido). */
export const priceComponentSchema = z.object({
  /** book/length: libro; copy: ejemplares extra (solo impresión); cards: tarjetas impresas del kit; design/piece: kit de Eventos. */
  code: z.enum(['book', 'copy', 'cards', 'length', 'design', 'piece']),
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
    reason: z.enum(['coupon', 'promotion', 'pro', 'bundle']).nullable(),
    /** Código del cupón o nombre de la promoción. */
    label: z.string().nullable(),
  }),
  shipping: z.object({
    minor: z.number().int().nonnegative(),
    etaDaysMin: z.number().int().nonnegative(),
    etaDaysMax: z.number().int().nonnegative(),
    /** Impreso sin dirección todavía: el envío se cotiza al completarla (no está en el total). */
    pending: z.boolean().default(false),
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

/** Lo que cuesta imprimir y enviar el pedido con la imprenta elegida, en centavos de USD. */
export interface PrintCost {
  /** Impresión de todas las unidades del pedido. */
  productionUsdMinor: number;
  /** Envío a la dirección; null: todavía sin dirección (se informa como pendiente). */
  shippingUsdMinor: number | null;
  etaDaysMin: number;
  etaDaysMax: number;
}

export interface QuoteInput {
  country: CountryConfig | null;
  /** Margen y costos del producto (productPricing/{formato}). */
  pricing: ProductPricing | Omit<ProductPricing, 'updatedAt'> | null;
  /** Tipo de cambio del día (unidades por dólar). */
  fx: FxRates;
  format: BookFormat;
  /** Páginas interiores del libro: el costo de IA depende de ellas. */
  pages: number;
  quantity: number;
  /** Impreso: costo de referencia de la imprenta (matriz del país) y, con dirección, el envío. */
  print?: PrintCost | null;
  coupon: Coupon | null;
  /** Código que escribió el comprador (aunque no exista). */
  couponCode: string | null;
  promotions: readonly Promotion[];
  now: Date;
  /**
   * Descuento por recurrencia (compras elegibles previas): vale para cualquier cuenta con sesión.
   * `professional`: además, el descuento base del producto del perfil profesional.
   */
  pro?: { purchases: number; config: ProDiscountConfig; professional: boolean } | null;
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
  if (coupon.type === 'fixed' && coupon.currency !== CHARGE_CURRENCY) {
    return 'coupon_not_applicable';
  }
  return null;
}

/**
 * Precio de un pedido, calculado siempre en el servidor (DECISIONS 096 y 097): costo + margen
 * del producto, todo en dólares. El impreso suma la impresión de la
 * imprenta elegida y el envío al costo. Se aplica un solo descuento: el mayor entre cupón,
 * promoción y Pro. Un cupón que no sirve no frena la compra: se informa (`couponError`).
 */
export function quote(input: QuoteInput): QuoteResult {
  const { country, pricing, format } = input;
  if (!country?.active) return { ok: false, error: 'country_unavailable' };
  if (!country.formats[format] || (pricing && !pricing.active)) {
    return { ok: false, error: 'format_unavailable' };
  }
  if (pricing?.product !== format) return { ok: false, error: 'price_missing' };
  const print = format === 'digital' ? null : (input.print ?? null);
  if (format !== 'digital' && !print) return { ok: false, error: 'format_unavailable' };

  const quantity = Math.max(1, Math.floor(input.quantity));
  const productionUnit = print ? Math.round(print.productionUsdMinor / quantity) : 0;
  const fee = paymentFeePercent(pricing);
  const usd = unitPriceUsdMinor(pricing, productionUnit, input.pages);
  // La creación (IA + margen) se cobra una vez; cada ejemplar extra paga solo su impresión.
  const copyUsd = usd - unitPriceUsdMinor(pricing, 0, input.pages);
  // Perfil profesional: descuento base del producto (además del de recurrencia, que es de todos).
  const withBase = (value: number) =>
    input.pro?.professional ? Math.round((value * (100 - pricing.proPercentOff)) / 100) : value;
  // El libro: el mismo cálculo que la barra de la muestra y las tarjetas del checkout.
  const unit = bookPriceMinor(pricing, productionUnit, input.pages, input.pro?.professional);
  const copyLocal = fromUsdMinor(withBase(withPaymentFee(copyUsd, fee)), CHARGE_CURRENCY, input.fx);
  const copy = copyLocal === null ? null : charmPrice(copyLocal, CHARGE_CURRENCY);
  if (copy === null) return { ok: false, error: 'price_missing' };

  // El envío se cobra al costo más su parte de la comisión de cobro (en dólares, sin redondear).
  const shippingMinor = withPaymentFee(print?.shippingUsdMinor ?? 0, fee);
  // Ningún descuento perfora el margen neto mínimo: el libro no baja de su piso y los ejemplares
  // extra, de su costo (con la comisión).
  const bookUnits = print ? 1 : quantity;
  const minSubtotal =
    bookFloorMinor(pricing, productionUnit, input.pages) * bookUnits +
    (print && quantity > 1 ? withPaymentFee(productionUnit, fee) * (quantity - 1) : 0);

  return finalize(
    [
      {
        code: 'book',
        unitMinor: unit,
        quantity: print ? 1 : quantity,
        totalMinor: print ? unit : unit * quantity,
      },
      ...(print && quantity > 1
        ? [
            {
              code: 'copy' as const,
              unitMinor: copy,
              quantity: quantity - 1,
              totalMinor: copy * (quantity - 1),
            },
          ]
        : []),
    ],
    country,
    format,
    input,
    {
      minor: shippingMinor,
      etaDaysMin: print?.etaDaysMin ?? 0,
      etaDaysMax: print?.etaDaysMax ?? 0,
      pending: print !== null && print.shippingUsdMinor === null,
    },
    0,
    minSubtotal,
  );
}

/**
 * Kit de Eventos: el diseño (una vez, incluye el librito) más la licencia digital de cada
 * pieza extra. Es digital: sin envío. Descuentos e impuestos, igual que un libro.
 */
export function quoteKit(
  input: Omit<QuoteInput, 'pricing' | 'fx' | 'print' | 'format' | 'pages' | 'quantity'> & {
    pricing: EventPricing | null;
    kit: KitSelection;
    /** "Pedir más copias" del mismo diseño: no se vuelve a cobrar el diseño. */
    reuseDesign?: boolean;
  },
): QuoteResult {
  const { country, pricing } = input;
  if (!country?.active) return { ok: false, error: 'country_unavailable' };
  if (!pricing?.active || pricing.currency !== CHARGE_CURRENCY) {
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
    // Lo que va incluido en el diseño (precio 0) no es un renglón del resumen.
    if (unit === 0) continue;
    components.push({ code: 'piece', piece, unitMinor: unit, quantity: 1, totalMinor: unit });
  }
  // Kit completo: todas las piezas que se ofrecen, sin que el diseño se vuelva a cobrar.
  const offered = Object.keys(pricing.pieces);
  const complete =
    !input.reuseDesign &&
    offered.length > 0 &&
    offered.every((piece) => input.kit.pieces.some((item) => item.piece === piece));
  return finalize(
    components,
    country,
    'digital',
    input,
    { minor: 0, etaDaysMin: 0, etaDaysMax: 0, pending: false },
    complete ? (pricing.bundlePercent ?? 0) : 0,
  );
}

/**
 * Tarjetas impresas del kit de Celebraciones (DECISIONS 140): un pedido aparte, enlazado al kit.
 * El precio es lo que cotizó la imprenta por todas las tarjetas más un margen de impresión (una
 * sola vez); el envío se cobra al costo. Es un impreso: aplica el descuento por volumen.
 */
export function quoteCards(
  input: Pick<
    QuoteInput,
    'country' | 'fx' | 'coupon' | 'couponCode' | 'promotions' | 'now' | 'pro'
  > & {
    print: PrintCost | null;
    margin: Margin;
  },
): QuoteResult {
  const { country, print } = input;
  if (!country?.active) return { ok: false, error: 'country_unavailable' };
  if (!print) return { ok: false, error: 'format_unavailable' };
  const usd = print.productionUsdMinor + marginUsdMinor(input.margin, print.productionUsdMinor);
  const local = fromUsdMinor(usd, CHARGE_CURRENCY, input.fx);
  if (local === null) return { ok: false, error: 'price_missing' };
  const total = charmPrice(local, CHARGE_CURRENCY);
  return finalize(
    [{ code: 'cards', unitMinor: total, quantity: 1, totalMinor: total }],
    country,
    'booklet',
    input,
    {
      minor: print.shippingUsdMinor ?? 0,
      etaDaysMin: print.etaDaysMin,
      etaDaysMax: print.etaDaysMax,
      pending: print.shippingUsdMinor === null,
    },
  );
}

function finalize(
  components: PriceSnapshot['components'],
  country: CountryConfig,
  format: BookFormat,
  input: Pick<QuoteInput, 'coupon' | 'couponCode' | 'promotions' | 'now' | 'country' | 'pro'>,
  shipping: PriceSnapshot['shipping'],
  /** Porcentaje por kit completo (Eventos): compite con el resto, se aplica el mayor. */
  bundlePercent = 0,
  /** Lo mínimo que puede quedar el subtotal con el descuento (margen neto mínimo; DECISIONS 241). */
  minSubtotalMinor = 0,
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
  // Descuento por volumen y recurrencia, de todos (un solo descuento: el mayor de todos).
  const percentPro = input.pro ? proPercent(input.pro.purchases, input.pro.config, format) : 0;
  const proMinor = Math.round((subtotal * percentPro) / 100);
  const bundleMinor = Math.round((subtotal * bundlePercent) / 100);
  const best = Math.max(couponMinor, promotionMinor, proMinor, bundleMinor);
  // El descuento nunca baja el subtotal del piso (el margen neto mínimo).
  const cap = Math.max(0, subtotal - minSubtotalMinor);
  const chosen =
    best === 0
      ? { minor: 0, reason: null, label: null }
      : couponMinor === best
        ? { minor: couponMinor, reason: 'coupon' as const, label: coupon?.code ?? null }
        : proMinor === best
          ? { minor: proMinor, reason: 'pro' as const, label: `${String(percentPro)} %` }
          : bundleMinor === best
            ? { minor: bundleMinor, reason: 'bundle' as const, label: `${String(bundlePercent)} %` }
            : {
                minor: promotionMinor,
                reason: 'promotion' as const,
                label: promotion?.name ?? null,
              };
  const discount =
    chosen.minor > cap
      ? cap > 0
        ? { ...chosen, minor: cap }
        : { minor: 0, reason: null, label: null }
      : chosen;

  const taxable = subtotal - discount.minor + shipping.minor;
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
      currency: CHARGE_CURRENCY,
      components,
      subtotalMinor: subtotal,
      discount,
      shipping,
      tax: { minor: taxMinor, basisPoints, included: country.taxIncludedInPrice },
      totalMinor: total,
    },
  };
}
