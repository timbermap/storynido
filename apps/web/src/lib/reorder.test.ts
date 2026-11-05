import { describe, expect, it } from 'vitest';

import { reorderStart } from './reorder';

const offer = [
  { format: 'digital' as const, amountMinor: 2199 },
  { format: 'hardcover' as const, amountMinor: 4299 },
  { format: 'softcover' as const, amountMinor: 3499 },
];

describe('otra copia de un pedido', () => {
  it('arranca en el formato impreso que compró', () => {
    expect(reorderStart([{ format: 'hardcover', quantity: 1 }], offer)).toEqual({
      kind: 'print',
      format: 'hardcover',
    });
  });

  it('si ese formato ya no se imprime en el país, en el impreso más barato (nunca el ebook)', () => {
    expect(reorderStart([{ format: 'booklet', quantity: 30 }], offer)).toEqual({
      kind: 'print',
      format: 'softcover',
    });
  });

  it('un libro creado en digital no se reimprime', () => {
    expect(reorderStart([{ format: 'digital', quantity: 1 }], offer)).toEqual({
      kind: 'digital_only',
    });
  });

  it('sin imprentas en el país no hay nada para pedir', () => {
    expect(
      reorderStart([{ format: 'softcover', quantity: 1 }], [{ format: 'digital', amountMinor: 1 }]),
    ).toEqual({ kind: 'no_print' });
  });
});
