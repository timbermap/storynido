import { describe, expect, it } from 'vitest';

import {
  bookLayout,
  storyIllustrations,
  fitTextPt,
  textHeightPct,
  textZoneOf,
  calmSideFor,
  layoutSceneNote,
  pageLayout,
  pagesPerScene,
  scenesFor,
  stripArtPct,
  stripFontScale,
  sceneNoteFor,
  WORDLESS_SCENE_NOTE,
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
      'bottom 35% of the image as plain warm cream paper',
    );
    expect(layoutSceneNote({ kind: 'facing', side: 'top' })).toContain('Full-page illustration');
    expect(layoutSceneNote({ kind: 'calm', side: 'top' })).toContain('top 35%');
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

describe('el texto se mide antes de elegir zona (DECISIONS 300)', () => {
  const upper = { font: 'quicksand', minPt: 22, maxPt: 26, uppercase: true } as const;
  // La página de «Angelica» (3-4 años, mayúsculas): 20 palabras tapaban casi la mitad de la hoja.
  const burbuja =
    'Una enorme burbuja rosa envuelve a Angelica con cuidado. ¡Ya puede flotar en el agua! ¡Plop, plop, a flotar!';
  const layout = bookLayout(4, 'story');

  it('estima que ese texto ocupa más de un tercio con la letra máxima', () => {
    expect(textHeightPct(burbuja, 26, upper)).toBeGreaterThan(40);
  });

  it('ya no se arma como zona calma: pasa al papel fundido y baja la letra', () => {
    const result = pageLayout({
      layout,
      words: 20,
      pageIndex: 1,
      text: burbuja,
      typography: upper,
    });
    expect(result.kind).toBe('vignette');
    expect(result.zonePct).toBe(40);
    expect(result.fontPt).toBeLessThan(26);
    expect(textHeightPct(burbuja, result.fontPt ?? 0, upper)).toBeLessThanOrEqual(42);
  });

  it('un texto corto sigue en la zona calma con la letra grande', () => {
    const result = pageLayout({
      layout,
      words: 5,
      pageIndex: 2,
      text: 'Luna mira el mar.',
      typography: upper,
    });
    expect(result).toMatchObject({ kind: 'calm', zonePct: 30, fontPt: 26 });
  });

  it('fitTextPt devuelve null si ni con la letra mínima entra', () => {
    expect(fitTextPt(burbuja, upper, 20)).toBeNull();
  });

  it('el prompt pide la zona completa y el control vigila la misma', () => {
    const tall = { kind: 'vignette', side: 'top', zonePct: 40 } as const;
    expect(layoutSceneNote(tall)).toContain('top 45%');
    expect(layoutSceneNote(tall)).toContain('lower 55%');
    expect(textZoneOf(tall)).toEqual({ textZone: { side: 'top', pct: 40 } });
    expect(textZoneOf({ kind: 'facing', side: 'top' })).toEqual({});
  });
});

describe('ilustraciones por largo (DECISIONS 321)', () => {
  const short = { interiorPages: 16, fixedPages: 2, activityShare: 0.25 };
  it('a doble página desde 9 años: 16 páginas son 7 ilustraciones', () => {
    expect(storyIllustrations(short, 11, 'story')).toBe(7);
    expect(storyIllustrations(short, 6, 'story')).toBe(14);
    expect(storyIllustrations(short, 11, 'coloring')).toBeNull();
  });
});

describe('página sin texto (libro de Angélica, 25 nov 2026)', () => {
  const calm = { kind: 'calm' as const, side: 'top' as const, zonePct: 30 };

  it('sin texto, la ilustración va entera y no hay zona que vigilar', () => {
    expect(sceneNoteFor(calm, '')).toBe(WORDLESS_SCENE_NOTE);
    expect(sceneNoteFor(calm, '   ')).toBe(WORDLESS_SCENE_NOTE);
    expect(textZoneOf(calm, '')).toEqual({});
  });

  it('con texto, pide la zona calma como siempre', () => {
    expect(sceneNoteFor(calm, 'Entro al bosque.')).toBe(layoutSceneNote(calm));
    expect(textZoneOf(calm, 'Entro al bosque.')).toEqual({ textZone: { side: 'top', pct: 30 } });
    expect(textZoneOf(calm)).toEqual({ textZone: { side: 'top', pct: 30 } });
  });
});
