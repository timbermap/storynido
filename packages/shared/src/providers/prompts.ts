import type { BookEvent } from '../models/events';
import type { Locale } from '../i18n';
import {
  describeTraits,
  type CharacterTraits,
  type Memories,
  type MustKeepTrait,
} from '../models/character';
import type { CharacterSheet, LessonPrompt, StoryPlan } from './ai';

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
  /** Eventos: cumpleaños (con la temática ya moderada). */
  event?: BookEvent | null;
  /** Densidad de texto y nivel de lectura (fase 07b). */
  wordsPerPage?: { min: number; max: number };
  levelGuidance?: string;
  /** Libro para colorear: escenas simples con frases muy breves. */
  coloring?: boolean;
  /** Plan del planificador editorial (guía A): el redactor lo sigue. */
  plan?: Omit<StoryPlan, 'usage'> | null;
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
  const event = input.event;
  const eventSection =
    event?.type === 'birthday'
      ? `

Es un cuento de cumpleaños para regalar a los invitados de la fiesta: ${input.childName}${
          event.turningAge ? ` cumple ${String(event.turningAge)} años` : ' festeja su cumpleaños'
        }.${event.theme ? ` La temática de la fiesta es «${event.theme}»: úsala en la aventura.` : ''}
La historia termina con la celebración (torta, velas y amigos). Que sea alegre, corta y fácil de leer
en voz alta; no nombres a los invitados.`
      : '';
  const planSection = input.plan
    ? `

Plan aprobado por el editor (seguilo página por página; no agregues personajes ni hechos fuera de él):
Tema: ${input.plan.theme}
Arco: ${input.plan.arc}
${input.plan.scenes
  .map(
    (scene) =>
      `- Página ${String(scene.pageIndex + 1)}: ${scene.sceneGoal} (${scene.emotionalBeat})${
        scene.personalDetail ? ` · detalle personal: ${scene.personalDetail}` : ''
      }`,
  )
  .join('\n')}`
    : '';
  return `${body}${memoriesSection}${eventSection}${planSection}

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
- Nunca te burles del cuerpo, la apariencia, la higiene, las capacidades o las necesidades del protagonista; nada de castigos que avergüencen, diagnósticos ni promesas de curación. El protagonista puede equivocarse, aprender y pedir ayuda sin quedar humillado.
- Escribe el nombre del protagonista exactamente así: "${input.childName}" (con sus tildes y mayúsculas).
- El título incluye el nombre del protagonista (por ejemplo, "La aventura espacial de ${input.childName}"): es la tapa del libro.
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

/** Protagonista en una frase para los prompts de imagen, con los rasgos que no pueden cambiar. */
export function describeCharacter(
  name: string,
  sheet: CharacterSheet,
  traits: CharacterTraits,
  mustKeep: readonly MustKeepTrait[],
): string {
  const extras = sheet.distinctiveFeatures.length
    ? `; also: ${sheet.distinctiveFeatures.join(', ')}`
    : '';
  return `${name}: child (${sheet.apparentAge}); ${describeTraits(traits, mustKeep)}; usually wears ${sheet.clothing}${extras}`;
}

/** Escena de la portada: el título va en la capa tipográfica, nunca dentro de la imagen. */
export function coverScene(title: string, firstScene: string | undefined): string {
  return `Book cover illustration for "${title}": the main character as the hero of the story, joyful and centered, leaving clear space at the top for the title. ${firstScene ?? ''}`;
}
