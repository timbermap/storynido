import { describe, expect, it, vi } from 'vitest';

import { drawFreeInvitation, FREE_INVITATION_SIZE, wrapLines } from './free-invitation';

const measure = (text: string) => text.length * 10;

describe('wrapLines', () => {
  it('parte en renglones que entran en el ancho', () => {
    expect(wrapLines(measure, 'Salón Pelotero Feliz, Av. Rivera 1234', 200)).toEqual([
      'Salón Pelotero',
      'Feliz, Av. Rivera',
      '1234',
    ]);
  });

  it('no corta una palabra larga ni deja renglones vacíos', () => {
    expect(wrapLines(measure, '  Supercalifragilístico  ', 50)).toEqual(['Supercalifragilístico']);
  });
});

describe('drawFreeInvitation', () => {
  it('dibuja la franja de marca con los datos de la fiesta adentro', () => {
    const texts: string[] = [];
    const rects: { y: number; h: number; fill: unknown }[] = [];
    const ctx: { fillStyle: unknown } & Record<string, unknown> = {
      fillStyle: '',
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
      fillRect(_x: number, y: number, _w: number, h: number) {
        rects.push({ y, h, fill: ctx.fillStyle });
      },
      fillText(text: string) {
        texts.push(text);
      },
      measureText: (text: string) => ({ width: text.length * 14 }),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
    };
    drawFreeInvitation(
      ctx as unknown as CanvasRenderingContext2D,
      { width: 1200, height: 1600 } as unknown as HTMLImageElement,
      {
        heading: '¡Mía cumple 5!',
        invite: '¡Te invito a mi fiesta!',
        details: [
          { label: 'Cuándo', value: 'sábado, 13 de diciembre de 2026' },
          { label: 'Dónde', value: 'Salón Pelotero Feliz' },
        ],
        brand: 'Invitación gratis · creá la tuya en storynido.com',
      },
      { display: 'serif', body: 'sans-serif' },
    );
    expect(texts).toContain('¡Mía cumple 5!');
    expect(texts).toContain('Salón Pelotero Feliz');
    expect(texts.at(-1)).toBe('✦ StoryNido · Invitación gratis · creá la tuya en storynido.com');
    // La franja llega hasta el borde de abajo y los datos van dentro de ella.
    const band = rects.find((rect) => rect.fill === '#a33f33');
    expect(band && band.y + band.h).toBe(FREE_INVITATION_SIZE.height);
    expect(texts.indexOf('Salón Pelotero Feliz')).toBeGreaterThan(texts.indexOf('¡Mía cumple 5!'));
  });
});
