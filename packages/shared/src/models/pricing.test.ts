import { describe, expect, it } from 'vitest';

import type { BookFormat } from './common';
import type { CountryConfig, Coupon, Promotion } from './commerce';
import { DEFAULT_PRODUCT_PRICING } from './product-pricing';
import type { EventPricing } from './kit';
import {
  DEFAULT_PRO_DISCOUNTS,
  proPercent,
  quote,
  quoteCards,
  quoteKit,
  type QuoteInput,
} from './pricing';

const NOW = new Date('2026-11-01T12:00:00Z');

const MX: CountryConfig = {
  code: 'MX',
  active: true,
  formats: { digital: true, softcover: true, hardcover: true, booklet: true },
  currency: 'MXN',
  defaultLocale: 'es',
  taxBasisPoints: 1600,
  taxIncludedInPrice: true,
  shipping: { costMinor: 14900, etaDaysMin: 5, etaDaysMax: 9 },
  updatedAt: NOW,
};

const US: CountryConfig = {
  ...MX,
  code: 'US',
  currency: 'USD',
  defaultLocale: 'en',
  taxBasisPoints: 800,
  taxIncludedInPrice: false,
  shipping: { costMinor: 699, etaDaysMin: 4, etaDaysMax: 8 },
};

const FX = { rates: { MXN: 18.5 }, source: 'test', date: '2026-11-01' };
const pricing = (format: BookFormat = 'hardcover') => ({
  ...DEFAULT_PRODUCT_PRICING[format],
  updatedAt: NOW,
});
// Tapa dura: USD 13,51 de impresión y 9,49 de envío a esa dirección.
const PRINT = { productionUsdMinor: 1351, shippingUsdMinor: 949, etaDaysMin: 6, etaDaysMax: 10 };

const coupon = (overrides: Partial<Coupon> = {}): Coupon => ({
  code: 'BIENVENIDA',
  type: 'percent',
  value: 10,
  currency: null,
  countries: [],
  validFrom: new Date('2026-01-01'),
  validUntil: null,
  maxRedemptions: null,
  redemptions: 0,
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const input = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  country: MX,
  pricing: pricing(),
  fx: FX,
  format: 'hardcover',
  pages: 28,
  quantity: 1,
  print: PRINT,
  coupon: null,
  couponCode: null,
  promotions: [],
  now: NOW,
  ...overrides,
});

describe('precio del pedido (servidor): costo + margen', () => {
  it('tapa dura en México: todo en dólares, envío al costo, IVA incluido', () => {
    const result = quote(input());
    if (!result.ok) throw new Error(result.error);
    // Creación: 0,15 × 28 + 17 = 21,20. Impresión: 13,51 + 8 (mínimo) = 21,51. → 42,71 → 42,99.
    expect(result.snapshot.currency).toBe('USD');
    expect(result.snapshot.components).toEqual([
      { code: 'book', unitMinor: 4299, quantity: 1, totalMinor: 4299 },
    ]);
    // Envío al costo, exacto: USD 9,49.
    expect(result.snapshot.shipping).toEqual({
      minor: 949,
      etaDaysMin: 6,
      etaDaysMax: 10,
      pending: false,
    });
    expect(result.snapshot.totalMinor).toBe(5248);
    expect(result.snapshot.tax).toEqual({ minor: 724, basisPoints: 1600, included: true });
  });

  it('impreso sin dirección: el envío queda pendiente y fuera del total', () => {
    const result = quote(input({ print: { ...PRINT, shippingUsdMinor: null } }));
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.shipping).toMatchObject({ minor: 0, pending: true });
    expect(result.snapshot.totalMinor).toBe(4299);
  });

  it('digital en EE. UU.: sin envío, el impuesto se suma; las páginas ajustan el precio', () => {
    const digital = quote(
      input({ country: US, format: 'digital', pricing: pricing('digital'), print: null }),
    );
    if (!digital.ok) throw new Error(digital.error);
    // 0,15 × 28 + 17 = 21,20 → 21,99.
    expect(digital.snapshot.components[0]).toMatchObject({ unitMinor: 2199 });
    expect(digital.snapshot.shipping.minor).toBe(0);
    expect(digital.snapshot.tax).toEqual({ minor: 176, basisPoints: 800, included: false });
    expect(digital.snapshot.totalMinor).toBe(2375);

    const mini = quote(
      input({
        country: US,
        format: 'digital',
        pricing: pricing('digital'),
        print: null,
        pages: 12,
        quantity: 2,
      }),
    );
    if (!mini.ok) throw new Error(mini.error);
    expect(mini.snapshot.components).toEqual([
      { code: 'book', unitMinor: 1899, quantity: 2, totalMinor: 3798 },
    ]);
  });

  it('margen en porcentaje o con mínimo, según lo que elija el admin', () => {
    const percent = quote(
      input({
        country: US,
        pricing: {
          ...pricing(),
          creationMargin: { mode: 'percent', fixedUsdMinor: 0, percent: 100 },
          printMargin: { mode: 'percent', fixedUsdMinor: 0, percent: 100 },
        },
      }),
    );
    if (!percent.ok) throw new Error(percent.error);
    // IA 4,20 × 2 + imprenta 13,51 × 2 = 35,42 → 35,99.
    expect(percent.snapshot.components[0]).toMatchObject({ unitMinor: 3599 });
  });

  it('se aplica un solo descuento: el mayor entre cupón y promoción', () => {
    const promotion: Promotion = {
      name: 'Buen Fin',
      discountPercent: 15,
      countries: ['MX'],
      formats: [],
      startsAt: new Date('2026-10-30'),
      endsAt: new Date('2026-11-05'),
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const withBoth = quote(
      input({ coupon: coupon(), couponCode: 'BIENVENIDA', promotions: [promotion] }),
    );
    if (!withBoth.ok) throw new Error(withBoth.error);
    expect(withBoth.snapshot.discount).toEqual({
      minor: 645,
      reason: 'promotion',
      label: 'Buen Fin',
    });

    const bigCoupon = quote(
      input({ coupon: coupon({ value: 20 }), couponCode: 'BIENVENIDA', promotions: [promotion] }),
    );
    if (!bigCoupon.ok) throw new Error(bigCoupon.error);
    expect(bigCoupon.snapshot.discount).toEqual({
      minor: 860,
      reason: 'coupon',
      label: 'BIENVENIDA',
    });
  });

  it('un cupón fijo no deja el subtotal negativo (el envío se paga igual)', () => {
    const result = quote(
      input({
        coupon: coupon({ type: 'fixed', value: 999999, currency: 'USD' }),
        couponCode: 'BIENVENIDA',
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.discount.minor).toBe(4299);
    expect(result.snapshot.totalMinor).toBe(949);
  });

  it('un cupón que no sirve se informa y se cobra sin él', () => {
    const cases = [
      [null, 'coupon_invalid'],
      [coupon({ validUntil: new Date('2026-10-01') }), 'coupon_expired'],
      [coupon({ maxRedemptions: 5, redemptions: 5 }), 'coupon_exhausted'],
      [coupon({ countries: ['US'] }), 'coupon_not_applicable'],
      // Los cupones fijos son en dólares (todo se cobra en USD).
      [coupon({ type: 'fixed', value: 500, currency: 'MXN' }), 'coupon_not_applicable'],
    ] as const;
    for (const [candidate, error] of cases) {
      const result = quote(input({ coupon: candidate, couponCode: 'X' }));
      if (!result.ok) throw new Error(result.error);
      expect(result.couponError).toBe(error);
      expect(result.snapshot.discount.minor).toBe(0);
    }
  });

  it('no se puede comprar: país apagado, formato apagado, sin imprenta o sin precio', () => {
    expect(quote(input({ country: { ...MX, active: false } }))).toEqual({
      ok: false,
      error: 'country_unavailable',
    });
    expect(
      quote(input({ country: { ...MX, formats: { ...MX.formats, hardcover: false } } })),
    ).toEqual({ ok: false, error: 'format_unavailable' });
    expect(quote(input({ pricing: { ...pricing(), active: false } }))).toEqual({
      ok: false,
      error: 'format_unavailable',
    });
    expect(quote(input({ print: null }))).toEqual({ ok: false, error: 'format_unavailable' });
    expect(quote(input({ pricing: null }))).toEqual({ ok: false, error: 'price_missing' });
  });
});

describe('kit de Eventos', () => {
  const pricing: EventPricing = {
    country: 'MX',
    currency: 'USD',
    active: true,
    designMinor: 24900,
    pieces: { activities: 4900, invitation: 6900, thank_you: 4900, stickers: 5900 },
    updatedAt: NOW,
  };
  const kit = (pieces: { piece: string; copies: number }[]) =>
    ({ pieces, invitation: null }) as Parameters<typeof quoteKit>[0]['kit'];
  const base = { country: MX, pricing, coupon: null, couponCode: null, promotions: [], now: NOW };

  it('diseño una vez + licencia por pieza; las copias no cambian el precio digital', () => {
    const thirty = quoteKit({
      ...base,
      kit: kit([
        { piece: 'mini_book', copies: 30 },
        { piece: 'stickers', copies: 30 },
      ]),
    });
    const five = quoteKit({
      ...base,
      kit: kit([
        { piece: 'mini_book', copies: 5 },
        { piece: 'stickers', copies: 5 },
      ]),
    });
    if (!thirty.ok || !five.ok) throw new Error('debería cotizar');
    expect(thirty.snapshot.components).toEqual([
      { code: 'design', unitMinor: 24900, quantity: 1, totalMinor: 24900 },
      { code: 'piece', piece: 'stickers', unitMinor: 5900, quantity: 1, totalMinor: 5900 },
    ]);
    expect(thirty.snapshot.totalMinor).toBe(24900 + 5900);
    expect(five.snapshot.totalMinor).toBe(thirty.snapshot.totalMinor);
    // Digital: sin envío; el IVA va incluido en México.
    expect(thirty.snapshot.shipping.minor).toBe(0);
    expect(thirty.snapshot.tax.included).toBe(true);
  });

  it('una pieza sin precio no se vende; el cupón aplica igual que en un libro', () => {
    expect(
      quoteKit({
        ...base,
        kit: kit([
          { piece: 'mini_book', copies: 1 },
          { piece: 'favor_tags', copies: 1 },
        ]),
      }),
    ).toEqual({ ok: false, error: 'format_unavailable' });
    const discounted = quoteKit({
      ...base,
      coupon: coupon(),
      couponCode: 'BIENVENIDA',
      kit: kit([{ piece: 'mini_book', copies: 10 }]),
    });
    if (!discounted.ok) throw new Error('debería cotizar');
    expect(discounted.snapshot.discount).toEqual({
      minor: 2490,
      reason: 'coupon',
      label: 'BIENVENIDA',
    });
    expect(
      quoteKit({ ...base, pricing: null, kit: kit([{ piece: 'mini_book', copies: 1 }]) }),
    ).toEqual({
      ok: false,
      error: 'price_missing',
    });
  });
});

describe('Profesionales: precio Pro y descuento por recurrencia', () => {
  const pro = (purchases: number, professional = true) => ({
    purchases,
    config: DEFAULT_PRO_DISCOUNTS,
    professional,
  });

  it('escalones: 1–4 base, 5–9 10 %, 10–19 15 %, 20+ 20 % (impresos con tope de 15 %)', () => {
    expect(
      [0, 4, 5, 9, 10, 19, 20, 50].map((n) => proPercent(n, DEFAULT_PRO_DISCOUNTS, 'digital')),
    ).toEqual([0, 0, 10, 10, 15, 15, 20, 20]);
    expect(proPercent(25, DEFAULT_PRO_DISCOUNTS, 'hardcover')).toBe(15);
  });

  it('descuento base Pro del producto y el del escalón; nunca suma con un cupón', () => {
    const family = quote(input({ pro: null }));
    const base = quote(input({ pro: pro(0) }));
    if (!family.ok || !base.ok) throw new Error('debería cotizar');
    // 10 % menos antes del precio lindo: 42,71 → 38,44 → 38,99 USD.
    expect(base.snapshot.components[0]).toMatchObject({ code: 'book', unitMinor: 3899 });
    expect(family.snapshot.components[0]).toMatchObject({ unitMinor: 4299 });
    expect(base.snapshot.discount.reason).toBeNull();

    const twelve = quote(input({ pro: pro(12) }));
    if (!twelve.ok) throw new Error('debería cotizar');
    // Tapa dura con 12 compras: 15 % (el tope de impresos también es 15).
    expect(twelve.snapshot.discount).toEqual({ minor: 585, reason: 'pro', label: '15 %' });

    // Un cupón del 10 % no se suma: gana el mayor (15 % Pro).
    const both = quote(input({ pro: pro(12), coupon: coupon(), couponCode: 'BIENVENIDA' }));
    if (!both.ok) throw new Error('debería cotizar');
    expect(both.snapshot.discount.reason).toBe('pro');
  });

  it('cualquier cuenta tiene el descuento por recurrencia; el base del producto es del perfil profesional', () => {
    const family = quote(input({ pro: null }));
    const common = quote(input({ pro: pro(0, false) }));
    if (!family.ok || !common.ok) throw new Error('debería cotizar');
    // Sin perfil profesional y sin compras previas: el mismo precio de siempre.
    expect(common.snapshot.components[0]).toEqual(family.snapshot.components[0]);
    expect(common.snapshot.discount.reason).toBeNull();

    // Con 12 compras en la ventana, el escalón aplica aunque no sea una cuenta profesional.
    const twelve = quote(input({ pro: pro(12, false) }));
    if (!twelve.ok) throw new Error('debería cotizar');
    expect(twelve.snapshot.discount).toMatchObject({ reason: 'pro', label: '15 %' });
    expect(twelve.snapshot.components[0]).toEqual(family.snapshot.components[0]);
  });
});

describe('ejemplares impresos', () => {
  it('la creación se cobra una vez y cada ejemplar extra paga solo su impresión', () => {
    const one = quote(
      input({
        country: US,
        format: 'booklet',
        pricing: pricing('booklet'),
        pages: 12,
        print: { productionUsdMinor: 996, shippingUsdMinor: 0, etaDaysMin: 5, etaDaysMax: 9 },
      }),
    );
    // 30 ejemplares: la imprenta cotizó USD 61,24 en total (2,04 c/u).
    const many = quote(
      input({
        country: US,
        format: 'booklet',
        pricing: pricing('booklet'),
        pages: 12,
        quantity: 30,
        print: { productionUsdMinor: 6124, shippingUsdMinor: 0, etaDaysMin: 5, etaDaysMax: 9 },
      }),
    );
    if (!one.ok || !many.ok) throw new Error('sin precio');
    const [book, copy] = many.snapshot.components;
    expect(book).toMatchObject({ code: 'book', quantity: 1 });
    expect(copy).toMatchObject({ code: 'copy', quantity: 29 });
    // Creación una vez (USD 18,80) + 30 ejemplares: nunca 30 veces el precio de uno.
    expect(many.snapshot.subtotalMinor).toBeLessThan(one.snapshot.subtotalMinor * 30);
    expect(many.snapshot.subtotalMinor).toBe((book?.totalMinor ?? 0) + (copy?.totalMinor ?? 0));
    // Cada ejemplar extra cuesta menos que el primero (que lleva la creación).
    expect(copy?.unitMinor).toBeLessThan(book?.unitMinor ?? 0);
  });
});

describe('tarjetas impresas del kit', () => {
  const base = {
    country: US,
    fx: FX,
    coupon: null,
    couponCode: null,
    promotions: [],
    now: NOW,
    margin: DEFAULT_PRODUCT_PRICING.booklet.printMargin,
  };

  it('suma la impresión cotizada, un margen una sola vez y el envío al costo', () => {
    const result = quoteCards({
      ...base,
      print: { productionUsdMinor: 1362, shippingUsdMinor: 1754, etaDaysMin: 14, etaDaysMax: 25 },
    });
    if (!result.ok) throw new Error(result.error);
    // 13,62 + margen mínimo de 8,00 = 21,62 → 21,99.
    expect(result.snapshot.components).toEqual([
      { code: 'cards', unitMinor: 2199, quantity: 1, totalMinor: 2199 },
    ]);
    expect(result.snapshot.shipping.minor).toBe(1754);
    expect(result.snapshot.shipping.pending).toBe(false);
  });

  it('sin dirección el envío queda pendiente', () => {
    const result = quoteCards({
      ...base,
      print: { productionUsdMinor: 1362, shippingUsdMinor: null, etaDaysMin: 5, etaDaysMax: 9 },
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.shipping.pending).toBe(true);
  });

  it('sin imprenta que pueda, no hay precio', () => {
    expect(quoteCards({ ...base, print: null })).toEqual({
      ok: false,
      error: 'format_unavailable',
    });
  });
});
