import { describe, expect, it } from 'vitest';

import { FORMAT_IMAGES, deliveredPieces, showcasePieces } from './format-showcase';

describe('showcasePieces («Así lo recibes»)', () => {
  it('solo el ebook mientras no se vende ningún impreso (sin «Muy pronto»)', () => {
    expect(showcasePieces([])).toEqual(['ebook']);
  });

  it('suma el libro impreso cuando el país vende tapa blanda o dura', () => {
    expect(showcasePieces(['softcover'])).toEqual(['ebook', 'printed']);
    expect(showcasePieces(['hardcover', 'softcover'])).toEqual(['ebook', 'printed']);
  });

  it('suma el cuento grapado solo si se vende', () => {
    expect(showcasePieces(['booklet'])).toEqual(['ebook', 'booklet']);
    expect(showcasePieces(['booklet', 'hardcover'])).toEqual(['ebook', 'printed', 'booklet']);
  });

  it('las imágenes de formato son las de Tomás (landing-*), nunca las de un libro real', () => {
    for (const src of Object.values(FORMAT_IMAGES)) {
      expect(src).toMatch(/^\/images\/formatos\/landing-[a-z-]+\.webp$/);
    }
  });

  it('el ebook entrega solo el PDF; un impreso, el libro y el PDF', () => {
    expect(deliveredPieces('digital')).toEqual(['ebook']);
    expect(deliveredPieces('softcover')).toEqual(['printed', 'ebook']);
    expect(deliveredPieces('hardcover')).toEqual(['printed', 'ebook']);
    expect(deliveredPieces('booklet')).toEqual(['booklet', 'ebook']);
  });
});
