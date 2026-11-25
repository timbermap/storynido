import { describe, expect, it } from 'vitest';

import { couponFromSearch, normalizeCoupon } from './coupon-field';

describe('cupón del enlace', () => {
  it('lee ?cupon=, ?coupon= y ?cupom= en mayúsculas', () => {
    expect(couponFromSearch('?cupon=amiga10')).toBe('AMIGA10');
    expect(couponFromSearch('?utm_source=ig&coupon=Navidad')).toBe('NAVIDAD');
    expect(couponFromSearch('?cupom=ola')).toBe('OLA');
  });

  it('ignora vacíos y caracteres raros', () => {
    expect(couponFromSearch('?cupon=')).toBeNull();
    expect(couponFromSearch('?x=1')).toBeNull();
    expect(normalizeCoupon('<script>')).toBeNull();
    expect(normalizeCoupon('  promo-1 ')).toBe('PROMO-1');
  });
});
