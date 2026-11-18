import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PALETTE,
  STORY_PALETTES,
  ageDirection,
  artDirection,
  mediumFor,
  withCurrentGuards,
} from './art-direction';

describe('dirección de arte de los libros', () => {
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
    expect(direction).toContain('the scene says which one, top or bottom');
    expect(direction).toContain('appears exactly once');
  });

  it('un libro con la dirección de arte congelada antes de las reglas las recibe al generar, una sola vez', () => {
    const old = "Art direction: premium children's picture book.";
    const updated = withCurrentGuards(old) ?? '';
    expect(updated).toContain('appears exactly once');
    expect(updated).toContain('the scene says which one, top or bottom');
    expect(updated).toContain('never jeans, everyday clothes or shoes in the water');
    expect(withCurrentGuards(updated)).toBe(updated);
    expect(withCurrentGuards(null)).toBeNull();
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
