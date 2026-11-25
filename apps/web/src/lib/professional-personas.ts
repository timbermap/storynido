import type { Locale } from '@storynido/shared';

/**
 * Plantillas de Profesionales por tipo de profesional (mesa 25 Nov 2026): cada perfil tiene su
 * página (/profesionales/plantillas/<perfil>) con las historias que más le sirven, en orden.
 * Las historias son las mismas del catálogo: un perfil solo elige y ordena. Las que no estén
 * activas en el catálogo se saltean solas.
 */
export const PERSONA_KEYS = [
  'teachers',
  'learning',
  'psychology',
  'speech',
  'occupational',
  'pediatrics',
  'dentistry',
] as const;

export type PersonaKey = (typeof PERSONA_KEYS)[number];

/** Slug de la página de cada perfil, por idioma (se traduce como el resto de las rutas). */
export const PERSONA_SLUGS: Record<Locale, Record<PersonaKey, string>> = {
  es: {
    teachers: 'docentes',
    learning: 'psicopedagogia',
    psychology: 'psicologia-infantil',
    speech: 'fonoaudiologia',
    occupational: 'terapia-ocupacional',
    pediatrics: 'pediatria',
    dentistry: 'odontopediatria',
  },
  en: {
    teachers: 'teachers',
    learning: 'learning-specialists',
    psychology: 'child-psychologists',
    speech: 'speech-therapists',
    occupational: 'occupational-therapists',
    pediatrics: 'pediatricians',
    dentistry: 'pediatric-dentists',
  },
  pt: {
    teachers: 'professores',
    learning: 'psicopedagogia',
    psychology: 'psicologia-infantil',
    speech: 'fonoaudiologia',
    occupational: 'terapia-ocupacional',
    pediatrics: 'pediatria',
    dentistry: 'odontopediatria',
  },
};

/** Historias de cada perfil, de la más útil a la menos. */
export const PERSONA_STORIES: Record<PersonaKey, string[]> = {
  teachers: [
    'mi-primer-dia-de-clases',
    'esperar-mi-turno',
    'me-equivoque-y-no-pasa-nada',
    'las-letras-de-mi-nombre',
    'las-letras-que-bailan',
    'el-jardin-de-las-emociones',
    'el-rincon-de-la-calma',
    'un-pasito-mas',
  ],
  learning: [
    'las-letras-que-bailan',
    'el-sonido-escondido',
    'detective-de-palabras',
    'las-letras-de-mi-nombre',
    'un-pasito-mas',
    'me-equivoque-y-no-pasa-nada',
    'esperar-mi-turno',
  ],
  psychology: [
    'el-volcan-del-enojo',
    'hoy-estoy-triste',
    'lo-que-siento-en-el-cuerpo',
    'el-jardin-de-las-emociones',
    'mi-termometro-verde-amarillo-rojo',
    'respiro-como-un-globo',
    'el-rincon-de-la-calma',
    'hermano-mayor',
  ],
  speech: [
    'el-sonido-escondido',
    'detective-de-palabras',
    'las-letras-de-mi-nombre',
    'las-letras-que-bailan',
    'voy-al-supermercado',
    'mi-rutina-de-la-manana',
  ],
  occupational: [
    'cuando-cambia-el-plan',
    'los-ruidos-fuertes',
    'cuando-todo-es-demasiado-ruido',
    'voy-al-supermercado',
    'mi-rutina-de-la-manana',
    'respiro-como-un-globo',
    'chau-panal',
  ],
  pediatrics: [
    'voy-al-medico-y-me-vacunan',
    'chau-panal',
    'hermano-mayor',
    'mi-rutina-de-la-manana',
    'mi-primer-dia-de-clases',
    'respiro-como-un-globo',
  ],
  dentistry: [
    'mi-visita-al-dentista',
    'voy-al-medico-y-me-vacunan',
    'los-ruidos-fuertes',
    'respiro-como-un-globo',
    'esperar-mi-turno',
  ],
};

export function personaFromSlug(locale: Locale, slug: string): PersonaKey | null {
  const slugs = PERSONA_SLUGS[locale];
  return PERSONA_KEYS.find((key) => slugs[key] === slug) ?? null;
}

/** Las historias del perfil que existen en el catálogo, en el orden del perfil. */
export function personaStories<T extends { slug: string }>(key: PersonaKey, stories: T[]): T[] {
  const bySlug = new Map(stories.map((story) => [story.slug, story]));
  return PERSONA_STORIES[key].flatMap((slug) => {
    const story = bySlug.get(slug);
    return story ? [story] : [];
  });
}
