import { describe, expect, it } from 'vitest';

import { matchesSearch, matchesTheme } from './story-themes';

const story = { title: 'Gol de campeón', summary: 'Un partido inolvidable', tags: ['fútbol'] };

describe('temáticas y búsqueda del catálogo', () => {
  it('temática por etiquetas; una desconocida no filtra', () => {
    expect(matchesTheme(story, 'heroes')).toBe(true);
    expect(matchesTheme(story, 'space')).toBe(false);
    expect(matchesTheme(story, 'otra')).toBe(true);
  });

  it('búsqueda sin tildes ni mayúsculas, todas las palabras', () => {
    expect(matchesSearch(story, 'FUTBOL')).toBe(true);
    expect(matchesSearch(story, 'campeon partido')).toBe(true);
    expect(matchesSearch(story, 'campeon dinosaurio')).toBe(false);
  });
});
