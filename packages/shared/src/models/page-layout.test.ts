import { describe, expect, it } from 'vitest';

import {
  bookLayout,
  calmSideFor,
  layoutSceneNote,
  pageLayout,
  pagesPerScene,
  scenesFor,
  stripArtPct,
  stripFontScale,
} from './page-layout';

const at = (age: number, words: number, pageIndex = 1, contentType = 'story') =>
  pageLayout({ layout: bookLayout(age, contentType), words, pageIndex, contentType });

describe('armado de página por edad', () => {
  it('hasta 6 años el texto va en la zona calma; si es largo, sobre el papel fundido', () => {
    expect(at(4, 20).kind).toBe('calm');
    expect(at(6, 32).kind).toBe('calm');
    expect(at(6, 33).kind).toBe('vignette');
  });

  it('la zona calma admite menos palabras cuanto más grande es la letra (DECISIONS 283)', () => {
    expect(at(2, 12).kind).toBe('calm');
    expect(at(2, 13).kind).toBe('vignette');
    expect(at(4, 22).kind).toBe('calm');
    expect(at(4, 25).kind).toBe('vignette');
  });

  it('7 y 8 años: la ilustración se funde en el papel', () => {
    expect(at(7, 20).kind).toBe('vignette');
    expect(at(8, 80).kind).toBe('vignette');
  });

  it('desde 9 años (y adultos): página de texto e ilustración enfrentadas, la mitad de escenas', () => {
    expect(at(9, 120).kind).toBe('facing');
    expect(at(40, 30).kind).toBe('facing');
    const layout = bookLayout(10, 'story');
    expect(scenesFor(30, layout)).toBe(15);
    expect(pagesPerScene(layout)).toBe(2);
    expect(scenesFor(30, bookLayout(5, 'story'))).toBe(30);
  });

  it('el lado se alterna como en el prompt y las muestras anteriores siguen con el panel', () => {
    expect(calmSideFor(1)).toBe('top');
    expect(calmSideFor(2)).toBe('bottom');
    expect(pageLayout({ layout: null, words: 30, pageIndex: 2 })).toEqual({
      kind: 'overlay',
      side: 'bottom',
    });
  });

  it('colorear: el texto va en una franja debajo del dibujo, nunca encima', () => {
    expect(bookLayout(10, 'coloring').facing).toBe(false);
    expect(at(10, 10, 1, 'coloring')).toEqual({ kind: 'strip', side: 'bottom' });
    expect(at(4, 10, 2, 'coloring')).toEqual({ kind: 'strip', side: 'bottom' });
    expect(layoutSceneNote({ kind: 'strip', side: 'bottom' })).toContain('separate white band');
  });

  it('el prompt pide el espacio que el armado necesita', () => {
    expect(layoutSceneNote({ kind: 'vignette', side: 'bottom' })).toContain(
      'bottom third of the image as plain warm cream paper',
    );
    expect(layoutSceneNote({ kind: 'facing', side: 'top' })).toContain('Full-page illustration');
    expect(layoutSceneNote({ kind: 'calm', side: 'top' })).toContain('top third');
  });
});

describe('franja de colorear según el largo del pie (DECISIONS 285)', () => {
  const words = (count: number) => Array.from({ length: count }, () => 'luna').join(' ');
  it('con el pie de siempre, 80 % de dibujo y la letra de siempre', () => {
    expect(stripArtPct(words(12))).toBe(80);
    expect(stripFontScale(words(12))).toBe(1);
  });
  it('con un pie largo la franja crece y la letra baja, con piso', () => {
    expect(stripArtPct(words(20))).toBe(70);
    expect(stripArtPct(words(37))).toBe(62);
    expect(stripFontScale(words(37))).toBe(0.8);
  });
});
