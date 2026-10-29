import { describe, expect, it } from 'vitest';

import type { CountryConfig, Coupon, Promotion } from './commerce';
import { DEFAULT_PRODUCT_PRICING } from './product-pricing';
import type { EventPricing } from './kit';
import { DEFAULT_PRO_DISCOUNTS, proPercent, quote, quoteKit, type QuoteInput } from './pricing';

const NOW = new Date('2026-11-01T12:00:00Z');

const MX: CountryConfig = {
  code: 'MX',
  active: true,
  formats: { digital: true, softcover: true, hardcover: true },
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
const pricing = (format: 'digital' | 'softcover' | 'hardcover' = 'hardcover') => ({
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
  length: 'classic',
  quantity: 1,
  print: PRINT,
  coupon: null,
  couponCode: null,
  promotions: [],
  now: NOW,
  ...overrides,
});

describe('precio del pedido (servidor): costo + margen', () => {
  it('tapa dura en México: (propio + impresión + margen) en pesos, envío al costo, IVA incluido', () => {
    const result = quote(input());
    if (!result.ok) throw new Error(result.error);
    // USD 1 + 13,51 + 28 = 42,51 → 786,44 MXN → precio lindo 786,99.
    expect(result.snapshot.components).toEqual([
      { code: 'book', unitMinor: 78699, quantity: 1, totalMinor: 78699 },
    ]);
    // Envío USD 9,49 → 175,57 MXN → hacia arriba, 176.
    expect(result.snapshot.shipping).toEqual({
      minor: 17600,
      etaDaysMin: 6,
      etaDaysMax: 10,
      pending: false,
    });
    expect(result.snapshot.totalMinor).toBe(96299);
    expect(result.snapshot.tax).toEqual({ minor: 13283, basisPoints: 1600, included: true });
  });

  it('impreso sin dirección: el envío queda pendiente y fuera del total', () => {
    const result = quote(input({ print: { ...PRINT, shippingUsdMinor: null } }));
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.shipping).toMatchObject({ minor: 0, pending: true });
    expect(result.snapshot.totalMinor).toBe(78699);
  });

  it('digital en EE. UU.: sin envío, el impuesto se suma; la extensión ajusta el precio', () => {
    const digital = quote(
      input({ country: US, format: 'digital', pricing: pricing('digital'), print: null }),
    );
    if (!digital.ok) throw new Error(digital.error);
    expect(digital.snapshot.components[0]).toMatchObject({ unitMinor: 1999 });
    expect(digital.snapshot.shipping.minor).toBe(0);
    expect(digital.snapshot.tax).toEqual({ minor: 160, basisPoints: 800, included: false });
    expect(digital.snapshot.totalMinor).toBe(2159);

    const mini = quote(
      input({
        country: US,
        format: 'digital',
        pricing: pricing('digital'),
        print: null,
        length: 'mini',
        quantity: 2,
      }),
    );
    if (!mini.ok) throw new Error(mini.error);
    expect(mini.snapshot.components).toEqual([
      { code: 'book', unitMinor: 1699, quantity: 2, totalMinor: 3398 },
    ]);
  });

  it('margen en porcentaje o con mínimo, según lo que elija el admin', () => {
    const percent = quote(
      input({
        country: US,
        pricing: { ...pricing(), marginMode: 'percent', marginPercent: 100 },
      }),
    );
    if (!percent.ok) throw new Error(percent.error);
    // (1 + 13,51) × 2 = 29,02 → 29,99.
    expect(percent.snapshot.components[0]).toMatchObject({ unitMinor: 2999 });
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
      minor: 11805,
      reason: 'promotion',
      label: 'Buen Fin',
    });

    const bigCoupon = quote(
      input({ coupon: coupon({ value: 20 }), couponCode: 'BIENVENIDA', promotions: [promotion] }),
    );
    if (!bigCoupon.ok) throw new Error(bigCoupon.error);
    expect(bigCoupon.snapshot.discount).toEqual({
      minor: 15740,
      reason: 'coupon',
      label: 'BIENVENIDA',
    });
  });

  it('un cupón fijo no deja el subtotal negativo (el envío se paga igual)', () => {
    const result = quote(
      input({
        coupon: coupon({ type: 'fixed', value: 999999, currency: 'MXN' }),
        couponCode: 'BIENVENIDA',
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.discount.minor).toBe(78699);
    expect(result.snapshot.totalMinor).toBe(17600);
  });

  it('un cupón que no sirve se informa y se cobra sin él', () => {
    const cases = [
      [null, 'coupon_invalid'],
      [coupon({ validUntil: new Date('2026-10-01') }), 'coupon_expired'],
      [coupon({ maxRedemptions: 5, redemptions: 5 }), 'coupon_exhausted'],
      [coupon({ countries: ['US'] }), 'coupon_not_applicable'],
      [coupon({ type: 'fixed', value: 500, currency: 'USD' }), 'coupon_not_applicable'],
    ] as const;
    for (const [candidate, error] of cases) {
      const result = quote(input({ coupon: candidate, couponCode: 'X' }));
      if (!result.ok) throw new Error(result.error);
      expect(result.couponError).toBe(error);
      expect(result.snapshot.discount.minor).toBe(0);
    }
  });

  it('no se puede comprar: país apagado, formato apagado, sin imprenta, sin precio o sin cambio', () => {
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
    expect(quote(input({ fx: { ...FX, rates: {} } }))).toEqual({
      ok: false,
      error: 'price_missing',
    });
  });
});

describe('kit de Eventos', () => {
  const pricing: EventPricing = {
    country: 'MX',
    currency: 'MXN',
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
  const pro = (purchases: number) => ({ purchases, config: DEFAULT_PRO_DISCOUNTS });

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
    // 10 % menos antes del precio lindo: 42,51 → 38,26 USD → 707,81 → 707,99 MXN.
    expect(base.snapshot.components[0]).toMatchObject({ code: 'book', unitMinor: 70799 });
    expect(family.snapshot.components[0]).toMatchObject({ unitMinor: 78699 });
    expect(base.snapshot.discount.reason).toBeNull();

    const twelve = quote(input({ pro: pro(12) }));
    if (!twelve.ok) throw new Error('debería cotizar');
    // Tapa dura con 12 compras: 15 % (el tope de impresos también es 15).
    expect(twelve.snapshot.discount).toEqual({ minor: 10620, reason: 'pro', label: 'Pro 15 %' });

    // Un cupón del 10 % no se suma: gana el mayor (15 % Pro).
    const both = quote(input({ pro: pro(12), coupon: coupon(), couponCode: 'BIENVENIDA' }));
    if (!both.ok) throw new Error('debería cotizar');
    expect(both.snapshot.discount.reason).toBe('pro');
  });
});
