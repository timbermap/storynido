import type { Locale } from '../i18n';
import type { Memories } from '../models/character';
import type { LessonPrompt } from './ai';

/** Variables que admiten las plantillas de stories (textPromptTemplate / imagePromptTemplate). */
export type TemplateVariables = Readonly<Record<string, string | number | null | undefined>>;

const LANGUAGE_NAMES: Record<Locale, string> = {
  es: 'español neutro (usa "tú", nunca "vos")',
  en: 'English',
  pt: 'português do Brasil',
};

const PRONOUN_LABELS = { she: 'ella', he: 'él', they: 'elle' } as const;

/**
 * Reemplaza {{variable}} por su valor. Las variables vacías o desconocidas quedan como "—"
 * para que una plantilla editada en el admin nunca mande llaves sueltas al modelo.
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, name: string) => {
    const value = variables[name];
    return value === null || value === undefined || value === '' ? '—' : String(value);
  });
}

/** Bloque de enseñanzas: la primera es la principal; se integran en la trama sin sermonear. */
export function lessonsBlock(lessons: readonly LessonPrompt[]): string {
  if (lessons.length === 0) return 'ninguna en particular: una aventura divertida y cálida';
  return lessons
    .map(
      (lesson, index) =>
        `${index === 0 ? 'Principal' : 'Secundaria'}: ${lesson.name}. ${lesson.guidance}`,
    )
    .join('\n');
}

export interface StoryPromptInput {
  template: string;
  language: Locale;
  pageCount: number;
  storyTitle: string;
  childName: string;
  age: number;
  pronouns: keyof typeof PRONOUN_LABELS | null;
  likes: readonly string[];
  petName: string | null;
  bestFriendName: string | null;
  lessons: readonly LessonPrompt[];
  /** Recuerdos guiados ya moderados (null si no hay). */
  memories?: Memories | null;
  /** Densidad de texto y nivel de lectura (fase 07b). */
  wordsPerPage?: { min: number; max: number };
  levelGuidance?: string;
  /** Libro para colorear: escenas simples con frases muy breves. */
  coloring?: boolean;
}

const MEMORY_LABELS: Record<keyof Memories, string> = {
  moment: 'Un momento especial para incluir',
  companion: 'Quién lo acompaña en la aventura',
  nickname: 'Cómo le dicen en casa',
  favorite: 'Lo que más disfruta',
};

/** Detalles reales de la familia: se integran con naturalidad y, si no encajan, se omiten. */
export function memoriesBlock(memories: Memories | null | undefined): string | null {
  if (!memories) return null;
  const lines = (Object.keys(MEMORY_LABELS) as (keyof Memories)[])
    .filter((key) => memories[key])
    .map((key) => `- ${MEMORY_LABELS[key]}: ${String(memories[key])}`);
  return lines.length ? lines.join('\n') : null;
}

/** Prompt de texto con la plantilla de la historia y reglas fijas que el admin no puede quitar. */
export function buildStoryPrompt(input: StoryPromptInput): string {
  const body = renderTemplate(input.template, {
    language: LANGUAGE_NAMES[input.language],
    pageCount: input.pageCount,
    storyTitle: input.storyTitle,
    childName: input.childName,
    age: input.age,
    pronouns: input.pronouns ? PRONOUN_LABELS[input.pronouns] : 'sin especificar',
    likes: input.likes.join(', '),
    petName: input.petName,
    bestFriendName: input.bestFriendName,
    lessons: lessonsBlock(input.lessons),
  });
  const memories = memoriesBlock(input.memories);
  const memoriesSection = memories
    ? `

Detalles reales de la familia (intégralos con naturalidad en escenas concretas; usa el apodo en
los diálogos; si alguno no encaja, omítelo; nunca agregues datos personales que no estén acá):
${memories}`
    : '';
  return `${body}${memoriesSection}

Reglas obligatorias:
- Escribe en ${LANGUAGE_NAMES[input.language]}.
- Exactamente ${String(input.pageCount)} páginas; ${input.childName} es el protagonista en todas.${
    input.wordsPerPage
      ? `
- Cada página tiene entre ${String(input.wordsPerPage.min)} y ${String(input.wordsPerPage.max)} palabras (esto reemplaza cualquier indicación anterior sobre la cantidad de oraciones).`
      : ''
  }${
    input.levelGuidance
      ? `
- Nivel de lectura: ${input.levelGuidance}`
      : ''
  }${
    input.coloring
      ? `
- Es un libro para colorear: cada escena tiene pocos elementos grandes y bien separados, fáciles de pintar.`
      : ''
  }
- Las enseñanzas se muestran con lo que hacen los personajes, nunca como moraleja explícita ni sermón.
- Nada de violencia, miedo intenso, marcas, personajes con derechos de autor ni datos personales reales.
- "illustrationPrompt" de cada página: la escena en inglés, en una o dos frases, sin texto dentro de la imagen.`;
}

export interface IllustrationPromptInput {
  template: string;
  scene: string;
  character: string;
  style: string;
}

export function buildIllustrationPrompt(input: IllustrationPromptInput): string {
  return renderTemplate(input.template, {
    scene: input.scene,
    character: input.character,
    style: input.style,
  });
}

/**
 * Lámina del personaje: el protagonista solo, sobre fondo liso, en el estilo elegido.
 * Es la referencia de la portada y de cada página (la portada completa arrastraba su fondo).
 */
export const CHARACTER_REFERENCE_SCENE =
  'Character reference sheet: the main character alone, full body, standing in a front three-quarter view with a friendly neutral pose, on a plain flat warm cream background. No scenery, no props, no other characters.';
