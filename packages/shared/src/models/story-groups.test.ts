import { describe, expect, it } from 'vitest';

import { STORY_GROUPS, storyGroups } from './story-groups';

describe('temas del filtro «Elige la aventura»', () => {
  it('una historia puede estar en varios temas por sus etiquetas', () => {
    expect(storyGroups({ slug: 'x', tags: ['mar', 'naturaleza', 'misterio'] })).toEqual([
      'adventure',
      'animals',
    ]);
    expect(storyGroups({ slug: 'x', tags: ['navidad', 'regalo'] })).toEqual(['gift']);
  });

  it('las historias sin etiquetas se ubican por su slug', () => {
    expect(storyGroups({ slug: 'mi-primer-dia-de-clases', tags: [] })).toEqual(['moments']);
    expect(storyGroups({ slug: 'las-tardes-con-los-abuelos', tags: [] })).toEqual(['gift']);
    expect(storyGroups({ slug: 'otra', tags: [] })).toEqual([]);
  });

  it('seis temas, en el orden del diseño', () => {
    expect(STORY_GROUPS.map((group) => group.key)).toEqual([
      'adventure',
      'animals',
      'magic',
      'sports',
      'moments',
      'gift',
    ]);
  });
});
