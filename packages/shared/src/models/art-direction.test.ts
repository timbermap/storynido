import { describe, expect, it } from 'vitest';

import { DEFAULT_PALETTE, STORY_PALETTES, artDirection } from './art-direction';

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
    expect(artDirection({ age: 2, channel: 'families' })).toContain('ages 2-3');
    expect(artDirection({ age: 7, channel: 'families' })).toContain('ages 6-8');
    expect(artDirection({ age: 11, channel: 'families' })).toContain('ages 9-12');
    expect(artDirection({ age: 5, channel: 'professionals' })).toContain('Avoid:');
  });

  it('para colorear: contornos, sin paleta', () => {
    const coloring = artDirection({ age: 5, channel: 'families', coloring: true });
    expect(coloring).toContain('line art');
    expect(coloring).not.toContain('Color palette');
  });
});
