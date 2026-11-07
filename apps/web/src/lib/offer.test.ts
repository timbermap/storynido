import { describe, expect, it } from 'vitest';

import { bookPrices } from './offer';

const source = {
  lengthPrices: [
    { length: 'short' as const, amountMinor: 1999 },
    { length: 'classic' as const, amountMinor: 2199 },
  ],
  proLengthPrices: [{ length: 'classic' as const, amountMinor: 1999 }],
  printLengthPrices: [
    {
      format: 'hardcover' as const,
      length: 'classic' as const,
      amountMinor: 4099,
      proAmountMinor: 3699,
    },
    {
      format: 'softcover' as const,
      length: 'classic' as const,
      amountMinor: 3499,
      proAmountMinor: 3199,
    },
    {
      format: 'booklet' as const,
      length: 'short' as const,
      amountMinor: 3699,
      proAmountMinor: 3299,
    },
  ],
};

describe('bookPrices', () => {
  it('da el precio exacto de la extensión y el impreso más barato', () => {
    expect(bookPrices(source, 'classic')).toEqual({
      digital: 2199,
      printed: 3499,
      printedFormats: ['softcover', 'hardcover'],
    });
    expect(bookPrices(source, 'short')).toEqual({
      digital: 1999,
      printed: 3699,
      printedFormats: ['booklet'],
    });
  });

  it('una cuenta profesional ve su precio con el descuento base', () => {
    expect(bookPrices(source, 'classic', true)).toMatchObject({ digital: 1999, printed: 3199 });
  });

  it('sin precio para esa extensión no inventa uno', () => {
    expect(bookPrices(source, 'epic')).toEqual({
      digital: null,
      printed: null,
      printedFormats: [],
    });
  });
});
