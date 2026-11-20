import { describe, expect, it } from 'vitest';

import { DEFAULT_EDITORIAL_CONFIG, miniPricedPages } from './editorial';
import { withKitCostFloor, type EventPricing } from './kit';
import { DEFAULT_PRODUCT_PRICING } from './product-pricing';

const digital = {
  ...DEFAULT_PRODUCT_PRICING.digital,
  paymentFeePercent: 5.4,
  paymentFeeFixedUsdMinor: 30,
};
const pages = miniPricedPages(DEFAULT_EDITORIAL_CONFIG);
const pricing = (designMinor: number): EventPricing => ({
  country: 'US',
  currency: 'USD',
  active: true,
  designMinor,
  pieces: { invitation: 0, thank_you: 300 },
  updatedAt: new Date(0),
});

describe('piso de costo del kit de Celebraciones', () => {
  it('sube el diseño al piso: IA del mini + margen neto mínimo + comisión', () => {
    // (1,50 + 8,00 + 0,30) ÷ 0,946 = 10,36 → 10,99
    expect(withKitCostFloor(pricing(999), digital, pages)?.designMinor).toBe(1099);
  });
  it('no toca un precio que ya está por encima, ni las piezas', () => {
    const high = pricing(1499);
    expect(withKitCostFloor(high, digital, pages)).toEqual(high);
    expect(withKitCostFloor(pricing(999), digital, pages)?.pieces).toEqual(pricing(999).pieces);
  });
  it('sin precio cargado, no hay kit', () => {
    expect(withKitCostFloor(null, digital, pages)).toBeNull();
  });
});
