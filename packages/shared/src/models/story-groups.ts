/**
 * Temas del filtro «Elige la aventura» (Familias): pocos grupos que resuelven las etiquetas de
 * cada historia (claves internas en español). Una historia puede estar en varios. Las historias
 * sin etiquetas se ubican por su slug, sin tocar los datos.
 */
export const STORY_GROUPS = [
  {
    key: 'adventure',
    tags: [
      'aventura',
      'espacio',
      'mar',
      'piratas',
      'tesoro',
      'autos',
      'carreras',
      'camiones',
      'vehículos',
      'superhéroes',
      'valentía',
      'misterio',
      'detectives',
      'exploración',
      'ciencia',
      'inventos',
      'robots',
      'videojuegos',
    ],
    slugs: [],
  },
  { key: 'animals', tags: ['animales', 'dinosaurios', 'naturaleza'], slugs: [] },
  {
    key: 'magic',
    tags: ['magia', 'hadas', 'princesas', 'príncipes', 'unicornios', 'fantasía'],
    slugs: [],
  },
  { key: 'sports', tags: ['fútbol', 'deportes'], slugs: [] },
  {
    key: 'moments',
    tags: [
      'hermanito',
      'pañal',
      'primer día de clases',
      'dormir',
      'rutina',
      'hitos',
      'enojo',
      'emociones',
      'calma',
      'diente',
      'nacimiento',
      'bebés',
      'cumpleaños',
    ],
    slugs: ['mi-primer-dia-de-clases'],
  },
  {
    key: 'gift',
    tags: [
      'regalo',
      'Día de la Madre',
      'Día del Padre',
      'navidad',
      'reyes',
      'abuelos',
      'amor',
      'mamá',
      'papá',
      'vínculo',
    ],
    slugs: ['las-tardes-con-los-abuelos'],
  },
] as const satisfies readonly { key: string; tags: readonly string[]; slugs: readonly string[] }[];

export type StoryGroup = (typeof STORY_GROUPS)[number]['key'];

/** Los grupos de una historia (por sus etiquetas o, si no las tiene, por su slug). */
export function storyGroups(story: { slug: string; tags: readonly string[] }): StoryGroup[] {
  return STORY_GROUPS.filter(
    (group) =>
      (group.slugs as readonly string[]).includes(story.slug) ||
      story.tags.some((tag) => (group.tags as readonly string[]).includes(tag)),
  ).map((group) => group.key);
}
