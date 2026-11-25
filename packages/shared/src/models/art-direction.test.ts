import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PALETTE,
  STORY_PALETTES,
  ageDirection,
  artDirection,
  characterSheetDirection,
  mediumFor,
  withCurrentGuards,
} from './art-direction';
import { STYLE_SHEETS, bookTypeSheet, imageCheckFor } from './style-sheets';

describe('dirección de arte de los libros', () => {
  it('la lámina del personaje no lleva reglas de composición de página', () => {
    const page = artDirection({ age: 7, channel: 'families' });
    expect(page).toContain('reserves one third of the image for the text');
    const sheet = characterSheetDirection(page) ?? '';
    expect(sheet).not.toContain('reserves one third of the image for the text');
    expect(sheet).not.toContain('wide establishing shot');
    expect(sheet).not.toContain('diagonal dynamic compositions');
    expect(page).toContain('Poses and framing');
    expect(sheet).not.toContain('Poses and framing');
    expect(sheet).toContain('Style lock');
  });

  it('paleta de la historia o, si no tiene, la del público', () => {
    expect(artDirection({ age: 5, channel: 'families', palette: 'adventure' })).toContain(
      STORY_PALETTES.adventure.colors[0],
    );
    expect(artDirection({ age: 5, channel: 'events' })).toContain(
      STORY_PALETTES[DEFAULT_PALETTE.events].colors[0],
    );
  });

  it('criterio por edad y lo que hay que evitar', () => {
    expect(artDirection({ age: 2, channel: 'families' })).toContain('ages 0-2');
    expect(artDirection({ age: 4, channel: 'families' })).toContain('ages 3-5');
    expect(artDirection({ age: 7, channel: 'families' })).toContain('ages 6-8');
    expect(artDirection({ age: 11, channel: 'families' })).toContain('ages 9-12');
    expect(artDirection({ age: 5, channel: 'professionals' })).toContain('Avoid:');
  });

  it('para colorear: contornos, sin paleta', () => {
    const coloring = artDirection({ age: 5, channel: 'families', coloring: true });
    expect(coloring).toContain('line art');
    expect(coloring).not.toContain('Color palette');
  });

  it('la técnica sigue al estilo: el 3D no se pide pintado a mano ni se prohíbe', () => {
    const threeD = artDirection({ age: 6, channel: 'families', style: 'cartoon-3d' });
    expect(threeD).toContain('3D animated feature film');
    expect(threeD).not.toContain('gouache');
    expect(threeD).not.toContain('glossy generic 3D');
    const watercolor = artDirection({ age: 6, channel: 'families', style: 'acuarela' });
    expect(watercolor).toContain('traditional watercolor');
    expect(watercolor).not.toContain('hand-painted digital gouache');
  });

  it('deja lugar para el texto y dibuja al protagonista una sola vez', () => {
    const direction = artDirection({ age: 6, channel: 'professionals' });
    expect(direction).toContain('the scene note says the text goes elsewhere');
    expect(direction).toContain('appears exactly once');
  });

  it('un libro con la dirección de arte congelada antes de las reglas las recibe al generar, una sola vez', () => {
    const old = "Art direction: premium children's picture book.";
    const updated = withCurrentGuards(old) ?? '';
    expect(updated).toContain('appears exactly once');
    expect(updated).toContain('the scene note says the text goes elsewhere');
    expect(updated).toContain('never jeans, everyday clothes or shoes in the water');
    expect(withCurrentGuards(updated)).toBe(updated);
    expect(withCurrentGuards(null)).toBeNull();
  });

  it('sin poses invertidas ni planos bajos de chicos, también en libros congelados antes', () => {
    const direction = artDirection({ age: 3, channel: 'families' });
    expect(direction).toContain('no child is ever drawn upside down');
    expect(direction).toContain('never a low, from-below');
    const updated = withCurrentGuards("Art direction: premium children's picture book.") ?? '';
    expect(updated).toContain('backbend or bridge');
  });

  it('ropa de deportes de agua y, de 9 a 12, sin técnica que pelee con el estilo', () => {
    const older = artDirection({ age: 11, channel: 'families', style: 'lapices-de-colores' });
    expect(older).toContain('wetsuit or swimwear');
    expect(older).toContain('cinematic framing');
    expect(older).not.toContain('firm ink');
    expect(older).not.toContain('flat color');
  });

  // Candado de estilo (DECISIONS 265): ninguna parte de la dirección de arte impone otra técnica.
  const STYLES = [
    'acuarela',
    'cartoon-3d',
    'cuento-clasico',
    'lapices-de-colores',
    'collage-papel',
    'minimalismo-grafico',
    'gouache-editorial',
    'novela-grafica',
    'cuaderno',
    'manga',
  ];
  const FOREIGN_TECHNIQUE = [
    'comic-book touches',
    'occasional panel',
    'textured brush work',
    'like printed paint',
  ];

  it.each(STYLES)('cada edad respeta el estilo elegido: %s', (style) => {
    for (const age of [1, 4, 7, 11]) {
      const direction = artDirection({ age, channel: 'families', style });
      expect(direction).toContain(`Style lock: the chosen art style is the only technique`);
      expect(direction).toContain(mediumFor({ style }));
      for (const phrase of FOREIGN_TECHNIQUE) expect(direction).not.toContain(phrase);
      if (style !== 'gouache-editorial') {
        expect(direction).not.toContain('hand-painted digital gouache');
        expect(direction).not.toContain('traditional editorial gouache');
      }
    }
  });

  it('un estilo nuevo del admin usa su propio modificador, no el gouache de la casa', () => {
    const direction = artDirection({
      age: 5,
      channel: 'families',
      style: 'linograbado',
      stylePrompt: 'linocut print with bold carved lines',
    });
    expect(direction).toContain('linocut print with bold carved lines');
    expect(direction).not.toContain('gouache');
  });

  it('para colorear: la técnica es de contornos, nunca gouache', () => {
    const coloring = artDirection({
      age: 5,
      channel: 'families',
      coloring: true,
      style: 'acuarela',
    });
    expect(coloring).toContain('coloring book line art');
    expect(coloring).not.toContain('gouache');
    expect(coloring).not.toContain('watercolor');
  });

  it('la edad no impone técnica', () => {
    for (const age of [1, 4, 7, 11]) {
      for (const phrase of FOREIGN_TECHNIQUE) expect(ageDirection(age)).not.toContain(phrase);
    }
  });

  it('las muestras y pedidos anteriores pierden las técnicas viejas y ganan el candado', () => {
    const legacy =
      "Art direction: premium children's picture book, classic narrative editorial illustration: ink line and opaque paint, as if one artist made the whole book. Color palette: #fff (calm); warm and harmonious like printed paint, slightly softened. For ages 6-8: taller proportions (head about a fifth of the body), diagonal dynamic compositions, the child in motion, humor, comic-book touches such as motion lines and the occasional panel, and memorable secondary characters. For ages 3-5: rounded proportions (head about a quarter of the body), expressive characters, textured brush work, a limited palette.";
    const updated = withCurrentGuards(legacy) ?? '';
    for (const phrase of FOREIGN_TECHNIQUE) expect(updated).not.toContain(phrase);
    expect(updated).toContain(
      'Style lock: the chosen art style is the only technique for every image of this book (character sheet, cover, every page, secondary characters and every redo): classic narrative editorial illustration: ink line and opaque paint.',
    );
    expect(withCurrentGuards(updated)).toBe(updated);
    const baby = artDirection({ age: 1, channel: 'families', style: 'collage-papel' });
    expect(withCurrentGuards(baby)).toBe(baby);
  });
});

describe('fichas de estilo y de tipo de libro (DECISIONS 282)', () => {
  const TYPES = ['story', 'story_activities', 'activities', 'coloring'] as const;

  it.each(Object.keys(STYLE_SHEETS))('%s combina su ficha con cada tipo de libro', (style) => {
    const sheet = STYLE_SHEETS[style];
    if (!sheet) throw new Error(style);
    for (const contentType of TYPES) {
      const coloring = contentType === 'coloring';
      const direction = artDirection({ age: 5, channel: 'families', style, contentType, coloring });
      expect(direction).toContain(
        bookTypeSheet(coloring || !sheet.usesPalette ? 'coloring' : contentType),
      );
      if (coloring || !sheet.usesPalette) {
        expect(direction).toContain('Black line art only for coloring');
        expect(direction).not.toContain('Color palette:');
      } else {
        expect(direction).toContain(sheet.medium);
        expect(direction).toContain(sheet.references);
        expect(direction).toContain('Color palette:');
      }
    }
  });

  it('colorear para bebés no pide colores por la edad', () => {
    const direction = artDirection({ age: 1, channel: 'families', coloring: true });
    expect(direction).not.toContain('warm, slightly softened colors');
    expect(direction).toContain('Ignore all their colors');
  });

  it('el control de un estilo sin ficha: colorear si su técnica es de colorear; si no, solo lo chillón', () => {
    expect(imageCheckFor({ stylePrompt: 'black and white coloring book line art' }).grayscale).toBe(
      true,
    );
    expect(imageCheckFor({ style: 'linograbado', stylePrompt: 'linocut print' })).toEqual({
      maxSaturation: 0.6,
    });
    expect(imageCheckFor({ style: 'acuarela', coloring: true }).grayscale).toBe(true);
  });
});
