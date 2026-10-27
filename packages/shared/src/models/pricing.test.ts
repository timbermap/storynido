import { describe, expect, it } from 'vitest';

import type { CountryConfig, Coupon, Price, Promotion } from './commerce';
import { quote, type QuoteInput } from './pricing';

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

const price = (overrides: Partial<Price> = {}): Price => ({
  country: 'MX',
  format: 'hardcover',
  currency: 'MXN',
  amountMinor: 89900,
  lengthAdjustmentsMinor: { mini: -20000, epic: 15000 },
  active: true,
  updatedAt: NOW,
  ...overrides,
});

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
  price: price(),
  format: 'hardcover',
  length: 'classic',
  quantity: 1,
  coupon: null,
  couponCode: null,
  promotions: [],
  now: NOW,
  ...overrides,
});

describe('precio del pedido (servidor)', () => {
  it('tapa dura en México: precio + envío, IVA incluido e informado', () => {
    const result = quote(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.subtotalMinor).toBe(89900);
    expect(result.snapshot.shipping.minor).toBe(14900);
    // Total 104 800 con IVA incluido: 16/116 del total es impuesto.
    expect(result.snapshot.totalMinor).toBe(104800);
    expect(result.snapshot.tax).toEqual({ minor: 14455, basisPoints: 1600, included: true });
  });

  it('digital: sin envío; en EE. UU. el impuesto se suma', () => {
    const result = quote(
      input({
        country: US,
        format: 'digital',
        price: price({ country: 'US', format: 'digital', currency: 'USD', amountMinor: 1999 }),
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.shipping.minor).toBe(0);
    expect(result.snapshot.tax).toEqual({ minor: 160, basisPoints: 800, included: false });
    expect(result.snapshot.totalMinor).toBe(2159);
  });

  it('la extensión ajusta el precio y queda como componente', () => {
    const result = quote(input({ length: 'mini', quantity: 2 }));
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.components).toEqual([
      { code: 'book', unitMinor: 89900, quantity: 2, totalMinor: 179800 },
      { code: 'length', unitMinor: -20000, quantity: 2, totalMinor: -40000 },
    ]);
    expect(result.snapshot.subtotalMinor).toBe(139800);
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
      minor: 13485,
      reason: 'promotion',
      label: 'Buen Fin',
    });

    const bigCoupon = quote(
      input({ coupon: coupon({ value: 20 }), couponCode: 'BIENVENIDA', promotions: [promotion] }),
    );
    if (!bigCoupon.ok) throw new Error(bigCoupon.error);
    expect(bigCoupon.snapshot.discount).toEqual({
      minor: 17980,
      reason: 'coupon',
      label: 'BIENVENIDA',
    });
  });

  it('un cupón fijo no deja el subtotal negativo', () => {
    const result = quote(
      input({
        coupon: coupon({ type: 'fixed', value: 999999, currency: 'MXN' }),
        couponCode: 'BIENVENIDA',
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.snapshot.discount.minor).toBe(89900);
    expect(result.snapshot.totalMinor).toBe(14900);
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

  it('país o formato no disponible, o precio sin cargar: no se puede comprar', () => {
    expect(quote(input({ country: { ...MX, active: false } }))).toEqual({
      ok: false,
      error: 'country_unavailable',
    });
    expect(
      quote(input({ country: { ...MX, formats: { ...MX.formats, hardcover: false } } })),
    ).toEqual({ ok: false, error: 'format_unavailable' });
    expect(quote(input({ price: null }))).toEqual({ ok: false, error: 'price_missing' });
    expect(quote(input({ price: price({ currency: 'USD' }) }))).toEqual({
      ok: false,
      error: 'price_missing',
    });
  });
});
