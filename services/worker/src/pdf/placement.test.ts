import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { textPlacements } from './placement';

const flat = () =>
  sharp({
    create: { width: 300, height: 400, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();

/** Ruido fino en la mitad de arriba: abajo es más calmo. */
async function busyTop() {
  const stripes = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">${Array.from(
      { length: 50 },
      (_, index) =>
        `<rect x="${String(index * 6)}" y="0" width="3" height="200" fill="#${index % 2 ? '222' : 'eee'}"/>`,
    ).join('')}</svg>`,
  );
  return sharp(await flat())
    .composite([{ input: stripes, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

describe('ubicación del texto', () => {
  it('prefiere el lado que el prompt pidió dejar calmo', async () => {
    const image = await flat();
    const [top] = await textPlacements([{ image, words: 80, calmSide: 'top' }], {
      allowCorners: false,
    });
    const [bottom] = await textPlacements([{ image, words: 80, calmSide: 'bottom' }], {
      allowCorners: false,
    });
    expect(top).toBe('top');
    expect(bottom).toBe('bottom');
  });

  it('el lado pedido gana aunque la página anterior fuera igual', async () => {
    const image = await flat();
    const placements = await textPlacements(
      [
        { image, words: 80, calmSide: 'top' },
        { image, words: 80, calmSide: 'top' },
      ],
      { allowCorners: false },
    );
    expect(placements).toEqual(['top', 'top']);
  });

  it('nunca pone el texto sobre una cara si hay otra región libre', async () => {
    const image = await flat();
    const [placement] = await textPlacements(
      [
        {
          image,
          words: 80,
          calmSide: 'bottom',
          // Cara abajo, justo donde el prompt pedía calma: el texto se va arriba.
          faces: [{ left: 0.4, top: 0.7, width: 0.2, height: 0.15 }],
        },
      ],
      { allowCorners: false },
    );
    expect(placement).toBe('top');
  });

  it('las esquinas también respetan las caras', async () => {
    const image = await flat();
    const [placement] = await textPlacements(
      [
        {
          image,
          words: 20,
          faces: [
            // Caras a la izquierda, arriba y abajo: solo quedan las esquinas de la derecha.
            { left: 0.05, top: 0.05, width: 0.15, height: 0.12 },
            { left: 0.05, top: 0.8, width: 0.15, height: 0.12 },
          ],
        },
      ],
      { allowCorners: true },
    );
    expect(['top-right', 'bottom-right']).toContain(placement);
  });

  it('si todas las regiones tapan una cara, igual elige una', async () => {
    const image = await flat();
    const [placement] = await textPlacements(
      [{ image, words: 80, faces: [{ left: 0, top: 0, width: 1, height: 1 }] }],
      { allowCorners: false },
    );
    expect(['top', 'bottom']).toContain(placement);
  });

  it('un lado pedido mucho más cargado pierde contra el otro', async () => {
    const [placement] = await textPlacements(
      [{ image: await busyTop(), words: 80, calmSide: 'top' }],
      { allowCorners: false },
    );
    expect(placement).toBe('bottom');
  });
});
