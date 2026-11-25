import type { EventType, Locale } from '@storynido/shared';

/**
 * Celebraciones por ocasión (mesa 25 Nov 2026, DECISIONS 330): «¿Qué celebrás?» arriba de las
 * temáticas, como las plantillas por profesional (DECISIONS 325). Cada ocasión tiene su página
 * (/eventos/tematicas/<ocasion>) con sus temáticas y cuentos. Las temáticas son las colecciones de
 * siempre: una ocasión solo las agrupa. Graduación va segunda porque fin de año es temporada de
 * egresos en el Cono Sur.
 */
export const OCCASION_KEYS = [
  'birthday',
  'graduation',
  'firstBirthday',
  'baptism',
  'communion',
] as const;

export type OccasionKey = (typeof OCCASION_KEYS)[number];

/** Slug de la página de cada ocasión, por idioma (se traduce como el resto de las rutas). */
export const OCCASION_SLUGS: Record<Locale, Record<OccasionKey, string>> = {
  es: {
    birthday: 'cumpleanos',
    graduation: 'graduacion',
    firstBirthday: 'primer-anito',
    baptism: 'bautizo',
    communion: 'primera-comunion',
  },
  en: {
    birthday: 'birthday',
    graduation: 'graduation',
    firstBirthday: 'first-birthday',
    baptism: 'baptism',
    communion: 'first-communion',
  },
  pt: {
    birthday: 'aniversario',
    graduation: 'formatura',
    firstBirthday: 'primeiro-aninho',
    baptism: 'batizado',
    communion: 'primeira-comunhao',
  },
};

/** El primer añito es un cumpleaños para el creador, pero se busca como ocasión aparte. */
const FIRST_BIRTHDAY_COLLECTIONS = new Set(['cumple-primer-anito']);

const BY_EVENT_TYPE: Record<EventType, OccasionKey> = {
  birthday: 'birthday',
  baptism: 'baptism',
  communion: 'communion',
  graduation: 'graduation',
};

/** A qué ocasión pertenece una temática: sin `eventType`, es de cumpleaños. */
export function occasionOf(collection: {
  slug: string;
  eventType?: EventType | null;
}): OccasionKey {
  if (FIRST_BIRTHDAY_COLLECTIONS.has(collection.slug)) return 'firstBirthday';
  return BY_EVENT_TYPE[collection.eventType ?? 'birthday'];
}

export function occasionFromSlug(locale: Locale, slug: string): OccasionKey | null {
  const slugs = OCCASION_SLUGS[locale];
  return OCCASION_KEYS.find((key) => slugs[key] === slug) ?? null;
}

/** Las temáticas de la ocasión, en el orden del catálogo. */
export function occasionCollections<T extends { slug: string; eventType?: EventType | null }>(
  key: OccasionKey,
  collections: T[],
): T[] {
  return collections.filter((collection) => occasionOf(collection) === key);
}

/** Los cuentos de las temáticas de la ocasión, sin repetir, en el orden de las temáticas. */
export function occasionStories<T extends { slug: string; collectionIds: string[] }>(
  collectionSlugs: string[],
  stories: T[],
): T[] {
  const seen = new Set<string>();
  return collectionSlugs.flatMap((collection) =>
    stories.filter((story) => {
      if (!story.collectionIds.includes(collection) || seen.has(story.slug)) return false;
      seen.add(story.slug);
      return true;
    }),
  );
}
