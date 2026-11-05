import { existsSync } from 'node:fs';
import path from 'node:path';

import { storyGroups, storySchema } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import {
  NEW_COVER_SLUGS,
  PENDING_COVER_SLUGS,
  SEED_DRAFT_STORIES,
  SEED_NEW_STORIES,
  SEED_PRO_STORIES,
  SEED_STORIES,
  SEED_STYLES,
  STORY_CAST,
} from '../seed-data/catalog';

const PUBLIC = path.resolve(__dirname, '../../apps/web/public');
const ALL = [...SEED_STORIES, ...SEED_NEW_STORIES, ...SEED_DRAFT_STORIES, ...SEED_PRO_STORIES];

/** Firestore rechaza `undefined`: el seed no puede mandarlo. */
function undefinedPaths(value: unknown, trail = ''): string[] {
  if (value === undefined) return [trail];
  if (Array.isArray(value))
    return value.flatMap((item, i) => undefinedPaths(item, `${trail}[${String(i)}]`));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.entries(value).flatMap(([key, item]) => undefinedPaths(item, `${trail}.${key}`));
  }
  return [];
}

describe('catálogo de ejemplo', () => {
  it('cada historia pasa el esquema y no manda undefined a Firestore', () => {
    for (const story of ALL) {
      const parsed = storySchema.parse({ ...story, createdAt: new Date(), updatedAt: new Date() });
      expect(undefinedPaths(parsed), story.slug).toEqual([]);
    }
  });

  it('las portadas y las muestras de estilo existen en public', () => {
    for (const story of ALL) {
      expect(existsSync(path.join(PUBLIC, story.coverImage)), story.coverImage).toBe(true);
    }
    for (const style of SEED_STYLES) {
      if (style.sampleImage) {
        expect(existsSync(path.join(PUBLIC, style.sampleImage)), style.sampleImage).toBe(true);
      }
    }
  });

  it('el elenco y las portadas nuevas apuntan a historias que existen', () => {
    // Las historias a la espera de su portada todavía no se siembran (PENDING_COVER_SLUGS).
    const slugs = new Set([...ALL.map((story) => story.slug), ...PENDING_COVER_SLUGS]);
    for (const slug of [...Object.keys(STORY_CAST), ...NEW_COVER_SLUGS]) {
      expect(slugs.has(slug), slug).toBe(true);
    }
  });

  it('los títulos con nombre usan la marca en los tres idiomas', () => {
    for (const story of ALL.filter((item) => STORY_CAST[item.slug])) {
      expect(story.title.es).toMatch(/\[Nombre\]/);
      expect(story.title.en).toMatch(/\[Name\]/);
      expect(story.title.pt).toMatch(/\[Nome\]/);
    }
  });
});

describe('temas del filtro «Elige la aventura»', () => {
  it('toda historia de Familias está en al menos un tema', () => {
    const families = ALL.filter((story) => (story.channels[0] ?? 'families') === 'families');
    const orphans = families.filter((story) => storyGroups(story).length === 0);
    expect(orphans.map((story) => story.slug)).toEqual([]);
  });
});
