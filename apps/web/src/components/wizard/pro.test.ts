import type { PublicCollection, PublicStory } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { baseStories, collectionOfDraft, storyNameFor } from './pro';

const collection = (slug: string, topics: string[]) => ({ slug, topics }) as PublicCollection;
const story = (slug: string, collectionIds: string[], ageMin = 3, ageMax = 8) =>
  ({ slug, collectionIds, ageMin, ageMax, channels: ['professionals'] }) as unknown as PublicStory;

describe('alias y nombre del cuento', () => {
  it('el alias es el nombre del cuento', () => {
    expect(storyNameFor(' Mati ', null)).toBe('Mati');
    expect(storyNameFor('Mati', { name: 'Otro', alias: 'Fede' })).toBe('Mati');
  });

  it('un proyecto anterior conserva su nombre si el alias no cambia', () => {
    expect(storyNameFor('Sofi, 2.º grado', { name: 'Sofi', alias: 'Sofi, 2.º grado' })).toBe(
      'Sofi',
    );
  });
});

describe('colección del borrador', () => {
  const collections = [
    collection('emociones', ['Vínculos']),
    collection('logros', ['Pedir ayuda']),
  ];

  it('prefiere la del objetivo y si no, la primera de la historia', () => {
    const shared = story('a', ['emociones', 'logros']);
    expect(collectionOfDraft(collections, shared, 'Pedir ayuda')?.slug).toBe('logros');
    expect(collectionOfDraft(collections, shared, null)?.slug).toBe('emociones');
  });

  it('sin historia o sin colección de Profesionales, ninguna', () => {
    expect(collectionOfDraft(collections, undefined, null)).toBeNull();
    expect(collectionOfDraft(collections, story('b', ['aventuras']), null)).toBeNull();
  });
});

describe('cuentos base', () => {
  it('solo los de la colección y de Profesionales, primero los de su edad', () => {
    const family = { ...story('f', ['c']), channels: ['families'] } as PublicStory;
    const list = [
      story('chicos', ['c'], 2, 4),
      story('grandes', ['c'], 7, 9),
      story('x', ['d']),
      family,
    ];
    expect(baseStories(list, 'c', 8).map((item) => item.slug)).toEqual(['grandes', 'chicos']);
  });
});
