import { describe, expect, it } from 'vitest';

import { LOCALES } from '@storynido/shared';

import {
  OCCASION_KEYS,
  OCCASION_SLUGS,
  occasionCollections,
  occasionFromSlug,
  occasionOf,
  occasionStories,
} from './event-occasions';

const collections = [
  { slug: 'cumple-superheroes', eventType: null },
  { slug: 'cumple-animales' },
  { slug: 'cumple-primer-anito', eventType: 'birthday' as const },
  { slug: 'primera-comunion', eventType: 'communion' as const },
  { slug: 'graduacion', eventType: 'graduation' as const },
  { slug: 'bautizo', eventType: 'baptism' as const },
];

describe('event occasions', () => {
  it('agrupa las temáticas por ocasión (sin eventType es cumpleaños; el primer añito va aparte)', () => {
    expect(occasionCollections('birthday', collections).map((c) => c.slug)).toEqual([
      'cumple-superheroes',
      'cumple-animales',
    ]);
    expect(occasionOf({ slug: 'cumple-primer-anito', eventType: 'birthday' })).toBe(
      'firstBirthday',
    );
    expect(occasionOf({ slug: 'primera-comunion', eventType: 'communion' })).toBe('communion');
    expect(occasionOf({ slug: 'bautizo', eventType: 'baptism' })).toBe('baptism');
  });

  it('tiene un slug único por ocasión en cada idioma y lo resuelve de vuelta', () => {
    for (const locale of LOCALES) {
      const slugs = OCCASION_KEYS.map((key) => OCCASION_SLUGS[locale][key]);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const key of OCCASION_KEYS) {
        expect(occasionFromSlug(locale, OCCASION_SLUGS[locale][key])).toBe(key);
      }
    }
    expect(occasionFromSlug('es', 'no-existe')).toBeNull();
  });

  it('junta los cuentos de las temáticas sin repetir, en el orden de las temáticas', () => {
    const stories = [
      { slug: 'gol', collectionIds: ['cumple-campeones'] },
      { slug: 'selva', collectionIds: ['cumple-animales'] },
      { slug: 'heroe', collectionIds: ['cumple-superheroes', 'cumple-animales'] },
    ];
    expect(
      occasionStories(['cumple-superheroes', 'cumple-animales'], stories).map((s) => s.slug),
    ).toEqual(['heroe', 'selva']);
  });
});
