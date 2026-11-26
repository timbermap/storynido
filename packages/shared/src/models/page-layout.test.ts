import { describe, expect, it } from 'vitest';

import {
  bookLayout,
  storyIllustrations,
  fitTextPt,
  textHeightPct,
  textZoneOf,
  VIGNETTE_FADE_PCT,
  vignetteArtPct,
  vignetteMaskStop,
  calmSideFor,
  layoutSceneNote,
  pageLayout,
  pagesPerScene,
  scenesFor,
  stripArtPct,
  stripFontScale,
  sceneNoteFor,
  WORDLESS_SCENE_NOTE,
  artAspectOf,
  bandArtPct,
  bandLayout,
} from './page-layout';

/** Armado de un libro congelado antes de `band` (DECISIONS 354): zona calma y papel fundido. */
const legacy = (age: number, contentType = 'story') => {
  const { band: _band, ...rest } = bookLayout(age, contentType);
  return rest;
};

const at = (age: number, words: number, pageIndex = 1, contentType = 'story') =>
  pageLayout({ layout: legacy(age, contentType), words, pageIndex, contentType });

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
  const layout = legacy(4);

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
    // En el papel fundido no puede haber nadie en la zona (Benicio, 25 nov); en la calma, sin caras.
    expect(textZoneOf(tall)).toEqual({ textZone: { side: 'top', pct: 40, whole: true } });
    expect(textZoneOf({ kind: 'calm', side: 'bottom', zonePct: 30 })).toEqual({
      textZone: { side: 'bottom', pct: 30 },
    });
    expect(textZoneOf({ kind: 'facing', side: 'top' })).toEqual({});
  });

  it('el papel fundido solo borra una franja angosta junto al texto', () => {
    // Zona de 40 %: la caja del dibujo ocupa el 70 % y se funde en su último 14 %, dentro del
    // margen libre de 45 % que pide el prompt.
    expect(vignetteArtPct(40)).toBe(70);
    expect(vignetteMaskStop(40)).toBe(86);
    expect(100 - vignetteArtPct(40) + VIGNETTE_FADE_PCT).toBeLessThanOrEqual(45);
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

describe('dibujo arriba, texto abajo (DECISIONS 354)', () => {
  const ages = {
    '0-2': { font: 'quicksand', minPt: 30, maxPt: 36, uppercase: true },
    '3-4': { font: 'quicksand', minPt: 22, maxPt: 26, uppercase: true },
    '5-6': { font: 'quicksand', minPt: 18, maxPt: 22, uppercase: true },
    '7-8': { font: 'andika', minPt: 15, maxPt: 17, uppercase: false },
    '9+': { font: 'fraunces', minPt: 13, maxPt: 15, uppercase: false },
  } as const;
  const sample =
    'el zorrito salta de piedra en piedra y tomi lo sigue riendo mientras el agua fría le moja los pies descalzos cuando llegan a la otra orilla encuentran una caja vieja con un mapa dibujado a mano'.split(
      ' ',
    );
  const words = (count: number) =>
    Array.from({ length: count }, (_, index) => sample[index % sample.length]).join(' ');

  it('los libros nuevos de hasta 8 años usan la franja; de 9 en adelante, páginas enfrentadas', () => {
    expect(bookLayout(4, 'story')).toMatchObject({ facing: false, band: true });
    expect(bookLayout(8, 'story_activities')).toMatchObject({ band: true });
    expect(bookLayout(10, 'story')).toMatchObject({ facing: true, band: false });
    expect(bookLayout(4, 'coloring').band).toBe(false);
    expect(
      pageLayout({
        layout: bookLayout(4, 'coloring'),
        words: 5,
        pageIndex: 1,
        contentType: 'coloring',
      }).kind,
    ).toBe('strip');
  });

  it('el texto nunca va sobre el dibujo y la ilustración se pide con su forma', () => {
    const layout = pageLayout({
      layout: bookLayout(4, 'story'),
      words: 20,
      pageIndex: 1,
      text: words(20),
      typography: ages['3-4'],
    });
    expect(layout).toMatchObject({ kind: 'band', side: 'bottom', art: '4:3', zonePct: 44 });
    expect(artAspectOf(layout, words(20))).toBe('4:3');
    expect(textZoneOf(layout, words(20))).toEqual({});
    expect(sceneNoteFor(layout, words(20))).toContain('never over it');
    // Sin texto, la ilustración va entera.
    expect(artAspectOf(layout, '')).toBe('3:4');
    expect(sceneNoteFor(layout, '')).toBe(WORDLESS_SCENE_NOTE);
  });

  it('los bebés llevan el dibujo cuadrado', () => {
    const layout = pageLayout({
      layout: bookLayout(2, 'story'),
      words: 8,
      pageIndex: 1,
      text: words(8),
      typography: ages['0-2'],
    });
    expect(layout).toMatchObject({ kind: 'band', art: '1:1', zonePct: 25 });
    expect(artAspectOf(layout)).toBe('1:1');
  });

  // Cada edad con su letra (tipo por la edad, tamaño por la franja de texto, que la densidad
  // corre un escalón) y el tope de palabras de esa franja: el texto entra con la letra completa.
  it.each([
    ['0-2', '0-2', 10],
    ['0-2', '3-4', 24],
    ['3-4', '0-2', 10],
    ['3-4', '3-4', 24],
    ['3-4', '5-6', 38],
    ['5-6', '3-4', 24],
    ['5-6', '5-6', 38],
    ['5-6', '7-8', 80],
    ['7-8', '5-6', 38],
    ['7-8', '7-8', 80],
    ['7-8', '9+', 140],
  ] as const)(
    '%s años, letra de %s, %i palabras: entra con la letra completa',
    (age, band, count) => {
      const ty = { ...ages[band], font: ages[age].font, uppercase: ages[age].uppercase };
      const layout = bandLayout(words(count), ty);
      expect(layout.kind).toBe('band');
      expect(layout.fontPt).toBe(ty.maxPt);
      expect(bandArtPct(layout.art) + (layout.zonePct ?? 0)).toBeCloseTo(100, 0);
    },
  );

  it('en el A5 grapado la franja es un poco más alta', () => {
    expect(bandArtPct('4:3', 210 / 148)).toBeLessThan(bandArtPct('4:3'));
  });
});
