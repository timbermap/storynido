import { describe, expect, it } from 'vitest';

import { publicPreviewSchema } from './contract';

describe('muestra: armado de página', () => {
  it('un armado que la web no conoce queda sin armado en vez de romper la muestra', () => {
    const page = publicPreviewSchema.shape.preview.unwrap().shape.pages.element;
    expect(
      page.parse({ index: 0, text: 'Hola', imageUrl: null, layout: { kind: 'nuevo', side: 'top' } })
        .layout,
    ).toBeUndefined();
    expect(
      page.parse({
        index: 0,
        text: 'Hola',
        imageUrl: null,
        layout: { kind: 'strip', side: 'bottom' },
      }).layout,
    ).toEqual({ kind: 'strip', side: 'bottom' });
  });
});
