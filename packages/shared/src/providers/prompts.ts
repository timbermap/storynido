import type { BookEvent } from '../models/events';
import type { Locale } from '../i18n';
import {
  describeTraits,
  type CharacterTraits,
  type Memories,
  type MustKeepTrait,
} from '../models/character';
import type { CastMember, CharacterSheet, LessonPrompt, StoryPlan } from './ai';

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
  /** Solo lo que entra al cuento: el lugar y lo que se compra no van al prompt. */
  event?: Pick<BookEvent, 'type' | 'date' | 'turningAge' | 'theme'> | null;
  /** Profesionales: objetivo general (guía narrativa, nunca clínica). */
  goal?: string | null;
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
  const eventSection = event
    ? `

${EVENT_STORY[event.type](input.childName, event.turningAge)}${
        event.theme ? ` La temática de la fiesta es «${event.theme}»: úsala en la aventura.` : ''
      }
Que sea alegre, corta y fácil de leer en voz alta; no nombres a los invitados.`
    : '';
  const goalSection = input.goal
    ? `

Objetivo general elegido por el profesional: «${input.goal}». Úsalo como guía de la historia
(situaciones, emociones y un cierre que invite a conversar). Es un cuento educativo: no des
indicaciones terapéuticas ni diagnósticos, y no menciones el objetivo de forma explícita.`
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
  return `${body}${memoriesSection}${eventSection}${goalSection}${planSection}

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
${narrativeRules(input)}
- Nada de violencia, miedo intenso, marcas, personajes con derechos de autor ni datos personales reales.
- Nunca te burles del cuerpo, la apariencia, la higiene, las capacidades o las necesidades del protagonista; nada de castigos que avergüencen, diagnósticos ni promesas de curación. El protagonista puede equivocarse, aprender y pedir ayuda sin quedar humillado.
- Escribe el nombre del protagonista exactamente así: "${input.childName}" (con sus tildes y mayúsculas).
- El título incluye el nombre del protagonista (por ejemplo, "La aventura espacial de ${input.childName}"): es la tapa del libro.
- "illustrationPrompt" de cada página: la escena en inglés, en una o dos frases, sin texto dentro de la imagen.`;
}

/** Qué celebra el cuento de Eventos y cómo termina, según la ocasión. */
const EVENT_STORY: Record<BookEvent['type'], (name: string, age: number | null) => string> = {
  birthday: (name, age) =>
    `Es un cuento de cumpleaños para regalar a los invitados de la fiesta: ${name}${
      age ? ` cumple ${String(age)} años` : ' festeja su cumpleaños'
    }.\nLa historia termina con la celebración (torta, velas y amigos).`,
  baptism: (name) =>
    `Es un cuento para regalar a los invitados del bautismo de ${name}.\nLa historia habla de bienvenida, familia y cariño, y termina con la celebración junto a sus seres queridos. Trata lo religioso con respeto y sin detalles de rituales.`,
  communion: (name) =>
    `Es un cuento para regalar a los invitados de la primera comunión de ${name}.\nLa historia habla de crecer, compartir y la familia, y termina con la celebración. Trata lo religioso con respeto y sin detalles de rituales ni enseñanzas doctrinales.`,
  graduation: (name) =>
    `Es un cuento para regalar a los compañeros en el egreso o el fin de año escolar de ${name}.\nLa historia recorre lo vivido en el año (amigos, juegos, lo aprendido) y termina con el festejo y las ganas de lo que viene.`,
};

/**
 * Reglas narrativas (AUDITORIA-PRODUCTO §4): lo que separa un cuento memorable de uno genérico.
 * Las de cada público salen del pedido: eventos traen la fiesta; profesionales, el objetivo.
 */
export function narrativeRules(input: Pick<StoryPromptInput, 'childName' | 'event' | 'goal'>) {
  const rules = [
    `- ${input.childName} decide y resuelve: no mira la aventura, la protagoniza.`,
    '- La primera página tiene un gancho que invita a dar vuelta la hoja.',
    '- Un objetivo claro y un desafío real para su edad, con un momento visual memorable.',
    '- El final cierra con calidez y deja ganas de releerlo.',
    '- Cada objeto o lugar importante se llama siempre igual y es el mismo en todas las páginas: una sola metáfora central, no varias.',
  ];
  if (input.event) {
    rules.push(
      '- Es una misión festiva con 2 o 3 mini desafíos; la celebración es la recompensa, no una lista de saludos.',
    );
  } else if (input.goal) {
    rules.push(
      '- Un solo objetivo en todo el cuento, con una secuencia realista y paso a paso de lo que vive el protagonista.',
      '- Nombra lo que siente (nervios, miedo, frustración) y dile que está bien sentirlo; muestra qué lo ayuda a atravesarlo, paso a paso: la emoción no desaparece por arte de magia. Nunca prometas resultados clínicos.',
      '- Nombra la emoción con una palabra y con una señal del cuerpo (por ejemplo, «me siento abrumada» y «el corazón me late rápido»).',
      '- Un adulto cercano valida lo que siente («está bien necesitar un rato») y lo acompaña sin resolverlo por el protagonista.',
      '- Si hay una técnica (respirar, contar, apretar un almohadón), descríbela en pasos concretos con conteo y un estribillo corto que se repite al menos dos veces.',
      '- Si hay un refugio o un rincón, es un lugar al que se va para volver: el final muestra que el protagonista regresa a lo que estaba haciendo.',
      '- No uses la palabra «mágicamente» ni atajos mágicos: el cambio ocurre porque el protagonista hizo algo.',
    );
  } else {
    rules.push('- Emoción y vínculo, con un conflicto verdadero que se resuelve.');
  }
  return rules.join('\n');
}

export interface IllustrationPromptInput {
  template: string;
  scene: string;
  character: string;
  style: string;
  /** Dirección de arte (art-direction.ts): bloque fijo al final, el admin no lo puede quitar. */
  direction?: string | null;
}

export function buildIllustrationPrompt(input: IllustrationPromptInput): string {
  const body = renderTemplate(input.template, {
    scene: input.scene,
    character: input.character,
    style: input.style,
  });
  return input.direction ? `${body}\n\n${input.direction}` : body;
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
  return `${name}: child (${sheet.apparentAge}); ${describeTraits(traits, mustKeep)}; everyday outfit: ${sheet.clothing} (use it when it suits the scene; dress the character for the activity, place and weather)${extras}`;
}

/**
 * Escena de la portada: el título va en la capa tipográfica, nunca dentro de la imagen. La portada
 * es una imagen propia (emblemática, más amplia que una página), no la primera página repetida:
 * la escena de la página 1 solo da el mundo de la historia, y el título, su idea.
 */
export function coverScene(firstScene: string | undefined, title?: string): string {
  const concept = title
    ? ` The cover must express the idea of the book's title (“${title}”) at a glance, as a picture only: never draw the title or any letters.`
    : '';
  const world = firstScene
    ? ` Story world, for the setting and mood only; do not copy this composition: ${firstScene}`
    : '';
  return `Book cover illustration, the single most iconic image of the book: the main character as the hero, large, joyful and centered, in a striking hero pose inside the story's most emblematic setting, richer and more dramatic than an inside page, with depth and a clear focal point and a different composition from the first page.${concept} Keep the top third as calm, simple background with no lettering: the title is typeset later.${world}`;
}

/** Datos de ejemplo para probar una plantilla desde el admin (sin datos reales ni IA). */
export const PROMPT_SAMPLE = {
  childName: 'Martina',
  age: 5,
  pronouns: 'she',
  likes: ['dinosaurios', 'pintar'],
  petName: 'Rocco',
  bestFriendName: 'Tomás',
  scene: 'The main character waves at the moon from a small rocket window.',
} as const;

/** Lo que recibiría la IA con esta plantilla: el prompt de texto y el de una ilustración. */
export function samplePrompts(input: {
  textPromptTemplate: string;
  imagePromptTemplate: string;
  title: string;
  language: Locale;
  pageCount: number;
  styleModifier: string;
  lessons?: readonly LessonPrompt[];
}): { text: string; image: string } {
  const sample = PROMPT_SAMPLE;
  return {
    text: buildStoryPrompt({
      template: input.textPromptTemplate,
      language: input.language,
      pageCount: input.pageCount,
      storyTitle: input.title,
      childName: sample.childName,
      age: sample.age,
      pronouns: sample.pronouns,
      likes: sample.likes,
      petName: sample.petName,
      bestFriendName: sample.bestFriendName,
      lessons: input.lessons ?? [],
    }),
    image: buildIllustrationPrompt({
      template: input.imagePromptTemplate,
      scene: sample.scene,
      character: `${sample.childName}, a ${String(sample.age)}-year-old girl with curly brown hair`,
      style: input.styleModifier,
    }),
  };
}

/** Escena de la lámina del acompañante: cuerpo entero, fondo liso, sin nadie más. */
export const companionReferenceScene = (companion: { name: string; look: string }) =>
  `Character reference sheet of ${companion.name}: ${companion.look}. Full body, neutral friendly pose, plain light background, nobody else in the image.`;

/** Lo que se suma a la descripción del personaje cuando el libro tiene acompañante. */
export const companionNote = (companion: { name: string; look: string }) =>
  `Recurring companion ${companion.name}: ${companion.look}. Whenever ${companion.name} appears, draw them identical to the second reference image.`;

/**
 * Personas secundarias que se repiten, para la ilustración de cada página: mismo género y aspecto
 * en todas, y solo se dibujan si la escena las incluye.
 */
export function castNote(cast: readonly CastMember[] | null | undefined): string {
  const members = (cast ?? []).filter((member) => member.role.trim() && member.look.trim());
  if (members.length === 0) return '';
  const lines = members.map((member) => {
    const gender = member.gender === 'unspecified' ? '' : `${member.gender}, `;
    return `${member.role}: ${gender}${member.look}`;
  });
  return ` Recurring supporting characters (draw each one with exactly the same gender and look on every page where the scene includes them; never add them to scenes that do not include them): ${lines.join('; ')}.`;
}
