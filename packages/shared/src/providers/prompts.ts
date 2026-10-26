import type { Locale } from '../i18n';
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
  return `${body}

Reglas obligatorias:
- Escribe en ${LANGUAGE_NAMES[input.language]}.
- Exactamente ${String(input.pageCount)} páginas; ${input.childName} es el protagonista en todas.
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
