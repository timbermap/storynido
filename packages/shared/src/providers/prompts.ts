import type { BookEvent } from '../models/events';
import type { Locale } from '../i18n';
import {
  describeTraits,
  type CharacterTraits,
  type Memories,
  type MustKeepTrait,
} from '../models/character';
import {
  SHOT_TYPES,
  type CastMember,
  type CharacterSheet,
  type LessonPrompt,
  type ScenePlan,
  type ShotType,
  type SpanishVoice,
  type StoryPlan,
  type StoryStructure,
} from './ai';
import { DIALOGUE_MIN_AGE } from './story-checks';

/** Variables que admiten las plantillas de stories (textPromptTemplate / imagePromptTemplate). */
export type TemplateVariables = Readonly<Record<string, string | number | null | undefined>>;

const LANGUAGE_NAMES: Record<Locale, string> = {
  es: 'español neutro (usa "tú", nunca "vos")',
  en: 'English',
  pt: 'português do Brasil',
};

/** Países donde el cuento habla de «vos» (voseo rioplatense, decidido el 05/11). */
export const VOSEO_COUNTRIES: readonly string[] = ['AR', 'UY'];

/** «vos» en Argentina y Uruguay; «tú» en el resto o si no se sabe el país. */
export function spanishVoiceFor(country: string | null | undefined): SpanishVoice {
  return country && VOSEO_COUNTRIES.includes(country.toUpperCase()) ? 'vos' : 'tu';
}

/** Idioma para el prompt, con el tratamiento del español según el país. */
export function languageName(language: Locale, voice: SpanishVoice = 'tu'): string {
  if (language === 'es' && voice === 'vos') {
    return 'español rioplatense (usa "vos" con sus formas: "querés", "mirá", "tenés", "vení"; nunca "tú" ni "vosotros")';
  }
  return LANGUAGE_NAMES[language];
}

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
  /** Densidad de texto (rango y tope de la franja de edad) y nivel de lectura (fase 07b). */
  wordsPerPage?: { min: number; max: number; cap?: number };
  /** Español: «vos» o «tú» según el país (por defecto «tú»). */
  spanishVoice?: SpanishVoice;
  levelGuidance?: string;
  /** Libro para colorear: escenas simples con frases muy breves. */
  coloring?: boolean;
  /** Plan del planificador editorial (guía A): el redactor lo sigue. */
  plan?: Omit<StoryPlan, 'usage'> | null;
  /** Edades para las que se escribió la historia del catálogo (si el protagonista no entra, se adapta). */
  storyAges?: { min: number; max: number } | null;
  /**
   * La idea de la historia del catálogo (su resumen, en el idioma del libro): es lo que el adulto
   * eligió y lo que promete la ficha. Sin esto, la IA solo veía el título y los gustos del chico
   * («Buenas noches» con «gimnasia» salió un cuento de acrobacias en la cama).
   */
  premise?: string | null;
  /** Cuento para dormir (etiqueta «dormir»): la energía baja y termina en la cama. */
  bedtime?: boolean;
}

/**
 * Historia elegida para otra edad (DECISIONS 264): «Buenas noches» es para 0 a 2 años y la eligieron
 * para una nena de 5. El cuento se adapta a la edad del protagonista.
 */
export function ageFitRule(
  age: number,
  storyAges: { min: number; max: number } | null | undefined,
): string | null {
  if (!storyAges || !Number.isFinite(age)) return null;
  if (age >= storyAges.min && age <= storyAges.max) return null;
  const range = `${String(storyAges.min)} a ${String(storyAges.max)} años`;
  return age > storyAges.max
    ? `- La historia del catálogo está pensada para ${range}, pero el protagonista tiene ${String(age)}: conserva su idea y su tono, y adapta el conflicto, el vocabulario y la estructura a ${String(age)} años (nada de fórmulas para bebés).`
    : `- La historia del catálogo está pensada para ${range}, pero el protagonista tiene ${String(age)}: conserva su idea y simplifica el conflicto, el vocabulario y las frases para ${String(age)} años.`;
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
  const language = languageName(input.language, input.spanishVoice);
  const body = renderTemplate(input.template, {
    language,
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
  const premise = input.premise?.trim();
  const premiseSection = premise
    ? `

Idea de esta historia (es lo que el adulto eligió en el catálogo y lo que le prometimos: respétala de
principio a fin). Los gustos del protagonista se suman como detalles, nunca cambian la idea ni el
tipo de cuento:
${premise}`
    : '';
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

Plan aprobado por el editor (síguelo página por página; no agregues personajes ni hechos fuera de él):
Tema: ${input.plan.theme}
Arco: ${input.plan.arc}${
        input.plan.structure
          ? `
Estructura de todo el libro: ${STRUCTURE_LABELS[input.plan.structure]}.`
          : ''
      }${
        input.plan.refrain
          ? `
Frase que se repite (al menos 3 veces, igual): «${input.plan.refrain}»`
          : ''
      }
${input.plan.scenes
  .map(
    (scene) =>
      `- Página ${String(scene.pageIndex + 1)}: ${scene.sceneGoal} (${scene.emotionalBeat})${
        scene.personalDetail ? ` · detalle personal: ${scene.personalDetail}` : ''
      }${scene.wordless ? ' · SIN TEXTO: "text" vacío (""), el dibujo cuenta solo' : ''}`,
  )
  .join('\n')}${
        input.plan.promises?.length
          ? `
Lo que se planta y se paga (respétalo: la pista o el objeto aparece antes y vuelve a servir después):
${input.plan.promises
  .map(
    (promise) =>
      `- «${promise.setup}»: se planta en la página ${String(promise.setupPage)} y se paga en la página ${String(promise.payoffPage)}.`,
  )
  .join('\n')}`
          : ''
      }`
    : '';
  return `${body}${premiseSection}${memoriesSection}${eventSection}${goalSection}${planSection}

Reglas obligatorias:
- Escribe en ${language}.
- Exactamente ${String(input.pageCount)} páginas; ${input.childName} es el protagonista en todas.${
    input.wordsPerPage
      ? `
- Cada página tiene entre ${String(input.wordsPerPage.min)} y ${String(input.wordsPerPage.max)} palabras${
          input.wordsPerPage.cap
            ? `, nunca más de ${String(input.wordsPerPage.cap)} (es para la edad de quien lo lee)`
            : ''
        } (esto reemplaza cualquier indicación anterior sobre la cantidad de oraciones).`
      : ''
  }${
    input.levelGuidance
      ? `
- Nivel de lectura: ${input.levelGuidance}`
      : ''
  }${
    input.coloring
      ? `
- Es un libro para colorear: cada escena tiene pocos elementos grandes y bien separados, fáciles de pintar. El texto de cada página es una sola frase corta (hasta 12 palabras), como pie del dibujo. La historia tiene un misterio o secreto concreto (lo que promete el título) que se descubre y se explica en las últimas páginas, con un pequeño giro. Cada escena es distinta y muestra una acción distinta; la ropa del protagonista no cambia entre páginas salvo que la historia lo pida. Si usas una frase que se repite, la dice siempre el protagonista (con raya de diálogo y verbo, como «—¡…! —dijo Lu»), nunca un objeto ni queda sin dueño. Termina con el protagonista en el lugar donde ocurre la historia, sin personajes que no hayan aparecido.`
      : ''
  }
- Las enseñanzas se muestran con lo que hacen los personajes, nunca como moraleja explícita ni sermón.${
    ageFitRule(input.age, input.storyAges)
      ? `
${ageFitRule(input.age, input.storyAges) ?? ''}`
      : ''
  }
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
    `Es un cuento para regalar a los invitados del bautismo de ${name}.\nLa historia habla de bienvenida, familia y cariño, y termina con la celebración junto a sus seres queridos. Trata lo religioso con respeto: sin magia ni personajes sagrados y sin detalles del rito.`,
  communion: (name) =>
    `Es un cuento para regalar a los invitados de la primera comunión de ${name}.\nLa historia habla de crecer, compartir, agradecer y la familia, y termina con la celebración. Trata lo religioso con respeto: sin magia ni personajes sagrados, sin detalles del rito y sin enseñanzas doctrinales.`,
  graduation: (name) =>
    `Es un cuento para regalar a los compañeros en el egreso o el fin de año escolar de ${name}.\nLa historia recorre lo vivido en el año (amigos, juegos, lo aprendido) y termina con el festejo y las ganas de lo que viene.`,
};

/** Cómo se le explica al redactor cada estructura del plan. */
export const STRUCTURE_LABELS: Record<StoryStructure, string> = {
  refrain: 'estribillo que vuelve (la misma frase al principio, en el medio y al final)',
  rhymed_quatrains: 'rima en cuartetas (cuatro versos por página que riman)',
  days_of_week: 'días de la semana (cada página o par de páginas es un día, de lunes a domingo)',
  cumulative: 'patrón acumulativo (cada página suma un personaje u objeto y repite los anteriores)',
  question_answer: 'pregunta y respuesta (cada página pregunta algo y la siguiente lo contesta)',
};

/**
 * Reglas de forma para menores de 7 (docs «Cuentos que cuidan»): lo que los hace inolvidables es
 * la forma, no solo la trama.
 */
export function formRules(age: number): string[] {
  if (age >= 7) return [];
  const rules = [
    `- Elige UNA estructura y respétala en todo el libro: ${Object.values(STRUCTURE_LABELS).join('; ')}.`,
    '- Una frase corta, fácil de decir en voz alta, se repite igual al menos 3 veces (es la que el chico termina diciendo con el adulto).',
    '- Usa onomatopeyas y sonidos (BRUM, PLAF, KIKIRIKÍ) cuando la escena lo permite.',
    '- Humor absurdo y lógica de chico con detalles concretos y sensoriales (un helado de papas fritas, un perro que va a la escuela en la mochila). Nada de adjetivos genéricos como «mágico», «increíble» o «maravilloso».',
    '- El texto nunca describe lo que muestra el dibujo: si se ve el cohete, cuenta lo que siente, dice o decide el protagonista.',
    '- Al final, un giro o una sorpresa que invite a releerlo.',
    '- Puedes narrar en primera persona, con la voz del protagonista («Hoy empiezo un viaje»), si le queda bien al cuento.',
  ];
  if (age >= 3) {
    rules.push(
      '- Las páginas que el plan marca SIN TEXTO llevan "text" vacío (""): en el clímax, el dibujo cuenta solo.',
    );
  }
  return rules;
}

/**
 * Contacto físico (DECISIONS 294, la mesa revisó un cuento con un abrazo apretado entre dos chicos):
 * el consuelo y el vínculo se cuentan con palabras, presencia y objetos. Vale para todas las líneas
 * y todos los tipos de libro.
 */
export const TOUCH_STORY_RULE =
  '- Contacto físico: el protagonista no abraza, besa, carga, toma en brazos ni se sienta en el regazo de nadie que no sea de su familia directa (mamá, papá, abuelos, hermanos), y nadie fuera de la familia lo toca a él: ni amigos, compañeros, docentes, entrenadores, profesionales ni desconocidos. Con ellos el afecto y el consuelo se cuentan con palabras, mirada, estar al lado, un objeto compartido, chocar los cinco o chocar puños. Con la familia, un abrazo corto solo si el pedido lo pide (dormir, «te quiero») y como mucho uno en todo el libro (salvo que el tema del cuento sea el cariño de la familia), contado con lo que siente y no con el cuerpo («mamá lo envolvió con su calor»). Un chico que quiere un abrazo lo pide («¿me das un abrazo?») y el otro puede decir que no. Nunca besos en la boca, cosquillas ni secretos entre un adulto y el chico.';

/**
 * Reglas narrativas (AUDITORIA-PRODUCTO §4): lo que separa un cuento memorable de uno genérico.
 * Las de cada público salen del pedido: eventos traen la fiesta; profesionales, el objetivo.
 */
export function narrativeRules(
  input: Pick<StoryPromptInput, 'childName' | 'event' | 'goal' | 'bedtime'> & { age?: number },
) {
  const rules = [
    `- ${input.childName} decide y resuelve: no mira la aventura, la protagoniza.`,
    '- La primera página tiene un gancho que invita a dar vuelta la hoja.',
    input.bedtime
      ? '- Es un cuento para leer antes de dormir: la energía baja página a página; la segunda mitad es tranquila (rutina, un último arrullo de mamá o papá con palabras, cosas que también se van a dormir) y la última página termina en la cama, en calma. Si hay un desafío, es pequeño y suave; nada de saltos, carreras ni acrobacias en la segunda mitad.'
      : '- Un objetivo claro y un desafío real para su edad, con un momento visual memorable.',
    '- El final cierra con calidez y deja ganas de releerlo.',
    TOUCH_STORY_RULE,
    '- Cada objeto o lugar importante se llama siempre igual y es el mismo en todas las páginas: una sola metáfora central, no varias. Lo mismo con lo que lleva el protagonista: si son anteojos, siempre «anteojos» (o «glasses»), sin sinónimos para no repetir.',
    '- El protagonista nunca hace como algo bueno lo que un chico podría imitar y lastimarse (saltar en la cama para alcanzar algo, trepar muebles o estantes, hacer la vertical contra la pared sin un adulto). Si el cuento lo muestra, es para que un adulto ayude o para buscar otra forma.',
  ];
  // Un primer añito o un bautizo es de un bebé: sin misión ni desafíos, la celebración es el cierre.
  const baby =
    input.event &&
    (input.event.type === 'baptism' ||
      (input.event.type === 'birthday' &&
        input.event.turningAge !== null &&
        input.event.turningAge <= 1));
  if (baby) {
    rules.push(
      '- Sin misión ni desafíos: una secuencia tierna y corta que termina en la celebración con la familia.',
    );
  } else if (input.event) {
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
  if (input.age !== undefined) rules.push(...formRules(input.age));
  rules.push(...craftRules(input.childName, input.age, Boolean(baby)));
  return rules.join('\n');
}

/**
 * Oficio del texto (arreglos del generador, PR B): lo que hace que un cuento se sienta escrito por
 * una persona. Por edad cuando se sabe; sin edad, las que valen para todos.
 */
export function craftRules(childName: string, age: number | undefined, baby = false): string[] {
  const rules = [
    '- Muestra, no cuentes: en lugar de decir lo que siente un personaje («estaba triste»), muestra lo que hace, dice o nota su cuerpo.',
    '- Todo lo que se plantea se paga: un misterio se resuelve con una pista plantada antes, y un objeto importante vuelve a servir más adelante.',
    '- Cada detalle personal aparece donde cambia algo en la escena, nunca de relleno.',
    '- La última página termina en una imagen o una frase que queda, nunca en una lección ni en una moraleja.',
  ];
  if (!baby) {
    rules.push(
      `- Como máximo dos intentos fallidos antes de lograrlo, y cada uno enseña algo distinto que ${childName} usa después.`,
      `- Si hay un mentor o un adulto, ayuda o da una pista, pero la solución final la encuentra ${childName}.`,
      `- Nunca narres en segunda persona: el narrador no le habla al lector ni al protagonista (nada de «tú», «vos» ni «you» fuera de un diálogo). Narra en tercera persona o, si le queda bien al cuento, en primera con la voz de ${childName}.`,
      '- Si el protagonista hace algo que un chico podría imitar y tiene riesgo (agua, altura, velocidad, fuego), usa el equipo de seguridad que corresponde y un adulto sabe dónde está.',
    );
  }
  if (age !== undefined && age >= DIALOGUE_MIN_AGE) {
    rules.push(
      '- Hay diálogo (con raya) en al menos una de cada tres páginas, y cada personaje habla distinto (su forma de decir las cosas lo delata sin nombrarlo).',
    );
  }
  if (age !== undefined && age >= 9) {
    rules.push(
      '- Oraciones de 20 palabras como máximo; nada de jerga técnica sin explicarla con palabras del lector.',
    );
  }
  return rules;
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

/**
 * La ropa no cambia entre páginas (Celebraciones, ola 1: el personaje pasaba de remera y jean a un
 * traje espacial, short y mameluco). Solo si el texto lo dice o la acción lo exige.
 */
export const SAME_OUTFIT =
  'the same outfit as in the reference sheet on every page, unless the page text explicitly says the character changes clothes or the action is impossible in it, such as swimming or sleeping';

/** La edad en palabras para el modelo: bebé, chico, adolescente o adulto. */
export function ageLabel(age: number): string {
  if (!Number.isFinite(age) || age < 1) return 'a baby under one year old';
  if (age < 13) return `a ${String(age)}-year-old child`;
  if (age < 18) return `a ${String(age)}-year-old teenager`;
  return `a ${String(age)}-year-old adult`;
}

/**
 * La edad del cuento manda sobre la de la foto (DECISIONS 264): una foto de adulto para un cuento
 * de 5 años se dibuja como esa persona a los 5.
 */
export const storyAgeRule = (age: number) =>
  `draw them exactly as they would look at ${String(age)} years old, with the face, height and body proportions of that age, even if the reference photo shows an older or younger person`;

/** Accesorios de la foto (anteojos de sol, gorros) que no son del personaje. */
export const NO_PHOTO_ACCESSORIES =
  'no accessories except the ones named here: never copy sunglasses, hats, caps, headphones, jewelry or bags from the photo';

/**
 * Rasgos de la foto que no sirven para dibujar al personaje: accesorios, marcas de la edad de
 * la foto (arrugas, barba, maquillaje) y anteojos (que van por el rasgo confirmado).
 */
const NOT_IDENTITY =
  /sunglass|shades|glasses|spectacles|hat\b|cap\b|beanie|hood|headphone|earbud|earring|necklace|bracelet|jewel|watch|bag\b|wrinkle|crow'?s feet|laugh lines|fine lines|age spots|beard|mustache|moustache|stubble|make-?up|lipstick|mascara|eyeliner|grey hair|gray hair|receding|cheekbone|jawline|strong jaw|defined jaw|adult|mature|tattoo|piercing/i;

export const identityFeatures = (features: readonly string[]) =>
  features.filter((feature) => feature.trim() && !NOT_IDENTITY.test(feature));

/**
 * Protagonista en una frase para los prompts de imagen, con los rasgos que no pueden cambiar. La
 * edad es la del cuento, nunca la aparente de la foto (DECISIONS 264).
 */
export function describeCharacter(
  name: string,
  age: number,
  sheet: CharacterSheet,
  traits: CharacterTraits,
  mustKeep: readonly MustKeepTrait[],
): string {
  const features = identityFeatures(sheet.distinctiveFeatures);
  const extras = features.length ? `; also: ${features.join(', ')}` : '';
  return `${name}: ${ageLabel(age)} (${storyAgeRule(age)}); ${describeTraits(traits, mustKeep)}; outfit: ${ageLabel(age)}'s version of ${sheet.clothing} (${SAME_OUTFIT}); ${NO_PHOTO_ACCESSORIES}${extras}`;
}

/** Lo mínimo del plan que necesita la portada: sus lugares y la escena de cada página. */
export type CoverPlan = Pick<StoryPlan, 'places' | 'scenes'> | null | undefined;

/**
 * Lugar de la portada: el lugar del cuento que más se repite, con su aspecto fijo. Sin plan con lugares, null.
 */
export function coverSetting(plan: CoverPlan): string | null {
  const places = (plan?.places ?? []).filter((place) => place.name.trim() && place.look.trim());
  if (places.length === 0) return null;
  const count = (name: string) =>
    plan?.scenes.filter((scene) => scene.place && sameName(scene.place, name)).length ?? 0;
  const main = places.toSorted((a, b) => count(b.name) - count(a.name))[0];
  return main ? `${main.name}, ${main.look}` : null;
}

/**
 * Escena de la portada: el título va en la capa tipográfica, nunca dentro de la imagen. La portada
 * es una imagen propia (más amplia que una página), no la primera página repetida. Va en un lugar
 * del cuento y con la misma técnica que las páginas: el «más dramático» de antes la llevaba a tinta
 * de historieta y a paisajes inventados (DECISIONS 264).
 */
export function coverScene(
  firstScene: string | undefined,
  title?: string,
  setting?: string | null,
): string {
  const concept = title
    ? ` It should evoke the book's title (“${title}”) through the scene itself, as a picture only: never draw the title or any letters.`
    : '';
  const place = setting
    ? ` Setting: ${setting}. Use only places and objects from the story; never invent new landscapes or locations.`
    : firstScene
      ? ` Story world, for the setting and mood only; do not copy this composition: ${firstScene.trim().replace(/\.+$/, '')}. Use only places from the story; never invent new landscapes.`
      : '';
  return `Book cover illustration: the main character large and centered in one of the story's own places, caught in the middle of the story's central activity or its happiest moment, with genuine emotion and body language (never the stiff standing pose of the reference sheet), with a clear focal point and a different composition from the first page.${place}${concept} Draw it with exactly the same art technique, line, texture, color treatment and character proportions as the inside pages and the reference sheet: the cover is never more stylized, more inked or more dramatic than the pages. Keep the top 40% as calm, simple background with no lettering and no head or face in it: the title is typeset there later.`;
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

/** Biblia visual del libro (plan): objetos, lugares y ropa con aspecto fijo. */
export type VisualBible = Pick<StoryPlan, 'props' | 'places' | 'outfits'>;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Objetos, lugar y encuadre de una escena, con el aspecto fijo de la biblia visual. Solo entra lo
 * que la escena incluye: un objeto que no está en la escena no se nombra (si se nombra, se dibuja).
 * Los planes anteriores a la biblia no traen nada y el prompt queda como antes.
 */
export function visualBibleNote(
  bible: VisualBible | null | undefined,
  scene: ScenePlan | null | undefined,
): string {
  if (!scene) return '';
  const props = [
    ...new Set(
      (scene.props ?? []).flatMap((name) =>
        (bible?.props ?? []).filter((prop) => prop.look.trim() && sameName(prop.name, name)),
      ),
    ),
  ];
  const scenePlace = scene.place;
  const place = scenePlace
    ? (bible?.places ?? []).find((item) => item.look.trim() && sameName(item.name, scenePlace))
    : undefined;
  const parts: string[] = [];
  if (props.length > 0) {
    parts.push(
      ` Recurring objects in this scene (draw each exactly like this, the same on every page): ${props
        .map((prop) => `${prop.name}: ${prop.look}`)
        .join('; ')}.`,
    );
  }
  if (place) parts.push(` Place: ${place.name}, ${place.look} (drawn the same way on every page).`);
  if (scene.shot) parts.push(` Camera: ${scene.shot} shot.`);
  return parts.join('');
}

/**
 * Ropa del protagonista en la escena si el plan pide una especial (en el agua, de noche); null:
 * la de la lámina.
 */
export function sceneOutfit(
  bible: VisualBible | null | undefined,
  scene: ScenePlan | null | undefined,
): string | null {
  const context = scene?.outfit;
  if (!context) return null;
  const outfit = (bible?.outfits ?? []).find(
    (item) => item.look.trim() && sameName(item.context, context),
  );
  return outfit
    ? `${outfit.look} (${outfit.context}; the same look on every page in this context)`
    : null;
}

/** Lo que la revisión de cada página compara con la biblia visual (objetos, lugar y ropa). */
export function visualBibleCheck(
  bible: VisualBible | null | undefined,
  scene: ScenePlan | null | undefined,
): string {
  const outfit = sceneOutfit(bible, scene);
  return `${visualBibleNote(bible, scene)}${outfit ? ` The main character wears ${outfit}.` : ''}`.trim();
}

/**
 * Encuadres variados: el mismo tres veces seguidas se cambia por otro (el modelo a veces los
 * repite aunque el prompt lo prohíba).
 */
export function varyShots<T extends { shot?: ShotType | null }>(scenes: readonly T[]): T[] {
  const result = scenes.map((scene) => ({ ...scene }));
  for (let index = 2; index < result.length; index += 1) {
    const current = result[index];
    const shot = current?.shot;
    if (!current || !shot) continue;
    if (result[index - 1]?.shot === shot && result[index - 2]?.shot === shot) {
      current.shot =
        SHOT_TYPES.find((other) => other !== shot && other !== result[index + 1]?.shot) ?? shot;
    }
  }
  return result;
}

/** Núcleo del rol para buscarlo en las escenas («the teacher» → «teacher»). */
const roleCore = (role: string) =>
  role
    .toLowerCase()
    .replace(/\b(the|a|an|male|female|young|old)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** La escena incluye a esa persona del elenco (la nombra en lo que tiene que verse). */
export function sceneIncludes(scene: ScenePlan | null | undefined, role: string): boolean {
  const core = roleCore(role);
  if (!scene || !core) return false;
  return scene.mustBeVisible.some((item) => item.toLowerCase().includes(core));
}

/**
 * La persona del elenco que más se repite (en dos escenas o más): tiene su propia lámina, como el
 * acompañante, para que se dibuje igual en todo el libro. null si nadie del elenco vuelve.
 */
export function mainCastMember(
  plan: Pick<StoryPlan, 'cast' | 'scenes'> | null | undefined,
): CastMember | null {
  let best: { member: CastMember; count: number } | null = null;
  for (const member of plan?.cast ?? []) {
    if (!member.role.trim() || !member.look.trim()) continue;
    const count = plan?.scenes.filter((scene) => sceneIncludes(scene, member.role)).length ?? 0;
    if (count >= 2 && (!best || count > best.count)) best = { member, count };
  }
  return best?.member ?? null;
}

/** La persona del elenco para su lámina (misma escena que la del acompañante). */
export const castMemberSheet = (member: CastMember) => ({
  name: member.role,
  look: member.gender === 'unspecified' ? member.look : `${member.gender}, ${member.look}`,
});

/** Nota para las escenas que incluyen a esa persona: dibujarla igual que su lámina. */
export const castSheetNote = (member: Pick<CastMember, 'role'>) =>
  ` ${member.role} looks exactly like the last reference image (their own reference sheet): same face, hair, build and clothes.`;

/**
 * Lo que la revisión del libro entero compara: el protagonista, quién se repite, la biblia visual y
 * qué tiene cada página según el plan.
 */
export function bookBibleSummary(input: {
  companion?: { name: string; look: string } | null;
  cast?: readonly CastMember[] | null;
  props?: VisualBible['props'];
  places?: VisualBible['places'];
  outfits?: VisualBible['outfits'];
  scenes: readonly ScenePlan[] | null;
}): string {
  const lines: string[] = [];
  if (input.companion)
    lines.push(`Recurring companion ${input.companion.name}: ${input.companion.look}`);
  for (const member of input.cast ?? []) {
    lines.push(`Recurring ${member.role} (${member.gender}): ${member.look}`);
  }
  for (const prop of input.props ?? []) lines.push(`Object ${prop.name}: ${prop.look}`);
  for (const place of input.places ?? []) lines.push(`Place ${place.name}: ${place.look}`);
  for (const outfit of input.outfits ?? []) {
    lines.push(`Protagonist outfit ${outfit.context}: ${outfit.look}`);
  }
  for (const scene of input.scenes ?? []) {
    const parts = [
      scene.mustBeVisible.length ? `shows ${scene.mustBeVisible.join(', ')}` : '',
      scene.notVisible.length ? `not ${scene.notVisible.join(', ')}` : '',
      scene.props?.length ? `objects ${scene.props.join(', ')}` : '',
      scene.place ? `place ${scene.place}` : '',
      scene.outfit ? `outfit ${scene.outfit}` : 'everyday outfit of the reference sheet',
    ].filter(Boolean);
    lines.push(`Page ${String(scene.pageIndex + 1)}: ${parts.join('; ')}`);
  }
  return lines.join('\n');
}
