import type { BookEvent } from '../models/events';
import type { Locale } from '../i18n';
import {
  avatarToSheet,
  describeTraits,
  type CharacterTraits,
  type Memories,
  type MustKeepTrait,
} from '../models/character';
import {
  SHOT_TYPES,
  type CastMember,
  type CharacterLook,
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
/**
 * Tercer intento de una ilustración rechazada por texto (DECISIONS 323): se sacan los objetos que
 * suelen llevar letras (pizarrón, carteles, pantallas) y se mantiene la escena. Lo usan el pedido
 * y la muestra (antes la muestra solo repetía «sin texto» y un aula fallaba los tres intentos).
 */
export const NO_TEXT_OBJECTS_HINT =
  'NO TEXT-BEARING OBJECTS: keep the same place, the same people and the same action as described, but do not draw signs, posters, banners, blackboards or whiteboards, screens, maps, diagrams, labels, packaging with writing, books, notebooks or papers with visible writing, lockers or doors with numbers, clocks, calendars, license plates, or clothing with prints or lettering. Show those surfaces blank or leave those objects out. Keep hands simple and faces calm.';

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
  /** Ropa de todos los días del protagonista (la de la lámina, DECISIONS 347). */
  protagonistOutfit?: string | null;
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
  /**
   * Profesionales: sonido o palabras para practicar que eligió el profesional, ya moderado
   * («el sonido escondido» prometía «el profesional elige el sonido» y no había dónde, 25 nov 2026).
   */
  practice?: string | null;
  /**
   * Profesionales: el profesional no conoce a la familia del chico. No entran mamá, papá ni
   * hermanos que el pedido no nombra (el libro de Angélica sumó un papá que nadie pidió).
   */
  professional?: boolean;
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

/**
 * Quién vuelve en el libro según el plan, con su nombre (DECISIONS 329): sin esto el redactor no
 * sabía quién era el amigo del plan y lo llamaba «mi compañero» en varias páginas.
 */
export function recurringCast(
  plan: Pick<StoryPlan, 'companion' | 'cast'> | null | undefined,
): string {
  const people = [
    ...(plan?.companion?.name.trim() ? [plan.companion.name.trim()] : []),
    ...(plan?.cast ?? [])
      .filter((member) => member.role.trim())
      .map((member) =>
        member.name?.trim() ? `${member.name.trim()} (${member.role.trim()})` : member.role.trim(),
      ),
  ];
  return people.length
    ? `
Personajes que vuelven (llámalos siempre así, con el mismo nombre en todas las páginas): ${people.join('; ')}`
    : '';
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
tipo de cuento. El lugar que nombran el título y esta idea (la selva, el mar, el espacio) es el
escenario del libro y sus personajes son los de la historia:
${premise}`
    : '';
  const memories = memoriesBlock(input.memories);
  const memoriesSection = memories
    ? `

Detalles reales de la familia (intégralos con naturalidad en escenas concretas; usa el apodo en
los diálogos; si alguno no encaja, omítelo; nunca agregues datos personales que no estén acá):
${memories}
Estos recuerdos pasan en la vida real (la casa, la bañera, el zoológico), pero el cuento pasa en el
lugar y con los personajes de la historia elegida: llévalos a ese mundo, nunca cambies el escenario
por el del recuerdo. Por ejemplo, en un cuento de la selva la espuma de la bañera se vuelve un
chapuzón en el río y el «hola» a la jirafa del zoológico se lo dice a un animal de la selva. Ninguna
página pasa en la casa salvo que la historia elegida pase ahí (o sea para dormir y termine en la cama).`
    : '';
  const event = input.event;
  const eventSection = event
    ? `

${EVENT_STORY[event.type](input.childName, event.turningAge)}${
        event.theme ? ` La temática de la fiesta es «${event.theme}»: úsala en la aventura.` : ''
      }
Que sea alegre, corta y fácil de leer en voz alta; los invitados van en grupo y sin nombre («sus amigos»): el único amigo con nombre es el mejor amigo del pedido, si lo hay.`
    : '';
  const goalSection = input.goal
    ? `

Objetivo general elegido por el profesional: «${input.goal}». Úsalo como guía de la historia
(situaciones, emociones y un cierre que invite a conversar). Es un cuento educativo: no des
indicaciones terapéuticas ni diagnósticos, y no menciones el objetivo de forma explícita.`
    : '';
  const practice = input.practice?.trim();
  const practiceSection = practice
    ? `

Sonido o palabras para practicar, elegidos por el profesional: «${practice}». Es el centro del cuento:
- Cada página con texto trae 2 o 3 palabras que lo contienen (palabras simples para su edad), sin forzar la frase.
- La frase que se repite lo contiene y es fácil de decir en voz alta; cuando algo suena (un animal, el viento, un motor), escríbelo como onomatopeya para repetir (por ejemplo «RRR, RRR»).
- Nadie corrige, apura ni se burla de cómo lo dice el protagonista: se juega, se escucha y se repite.`
    : '';
  const professionalSection = input.professional
    ? `

Es un cuento que un profesional (docente, terapeuta) usa con un chico cuya familia no conoce: no aparecen mamá, papá, hermanos ni otros familiares que el pedido no nombra, salvo que la idea de la historia los necesite (un hermanito que llega). Si hace falta un adulto, es uno del cuento llamado por su rol (la seño, el guardabosque), sin contacto físico; la solución la encuentra el protagonista.`
    : '';
  const planSection = input.plan
    ? `

Plan aprobado por el editor (síguelo página por página; no agregues personajes ni hechos fuera de él):
Tema: ${input.plan.theme}
Arco: ${input.plan.arc}${recurringCast(input.plan)}${
        input.plan.structure
          ? `
Estructura de todo el libro: ${STRUCTURE_LABELS[input.plan.structure]}.`
          : ''
      }${
        input.plan.refrain
          ? `
Frase que se repite (al menos 3 veces, letra por letra, sin sinónimos ni variantes): «${input.plan.refrain}»`
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
  return `${body}${premiseSection}${memoriesSection}${eventSection}${goalSection}${practiceSection}${professionalSection}${planSection}

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
- Escribe el nombre del protagonista exactamente así: "${input.childName}" (con sus tildes y mayúsculas).${
    input.protagonistOutfit?.trim()
      ? `
- La ropa de ${input.childName} es la de su dibujo: ${input.protagonistOutfit.trim()} (en inglés). Si el texto la nombra, usa esas mismas prendas y colores; nunca inventes otra prenda, color ni estampado. Solo cambia de ropa si la historia lo pide (bañarse, nadar, disfrazarse) y dilo con palabras simples.`
      : ''
  }
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
    '- Una frase corta, fácil de decir en voz alta, se repite igual al menos 3 veces, letra por letra (es la que el chico termina diciendo con el adulto): nunca la cambies por una parecida («Oigo, oigo» no pasa a «Escucho, escucho»).',
    '- Usa onomatopeyas y sonidos (BRUM, PLAF, KIKIRIKÍ) cuando la escena lo permite. Si un sonido mueve la historia (un silbido, un golpe, un canto), escríbelo como onomatopeya (FIU, FIU) cada vez que suena, siempre igual.',
    '- Humor absurdo y lógica de chico con detalles concretos y sensoriales (un helado de papas fritas, un perro que va a la escuela en la mochila). Nada de adjetivos genéricos como «mágico», «increíble» o «maravilloso».',
    '- El texto nunca describe lo que muestra el dibujo: si se ve el cohete, cuenta lo que siente, dice o decide el protagonista.',
    '- Al final, un giro o una sorpresa que invite a releerlo.',
    '- Puedes narrar en primera persona, con la voz del protagonista («Hoy empiezo un viaje»), si le queda bien al cuento.',
  ];
  if (age >= 3) {
    rules.push(
      '- Las páginas que el plan marca SIN TEXTO llevan "text" vacío (""): en el clímax, el dibujo cuenta solo. Todas las demás llevan texto, aunque el plan no lo haya escrito.',
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
  '- Contacto físico: el protagonista no abraza, besa, carga, toma en brazos ni se sienta en el regazo de nadie que no sea de su familia directa (mamá, papá, abuelos, hermanos), y nadie fuera de la familia lo toca a él: ni amigos, compañeros, docentes, entrenadores, profesionales ni desconocidos. Con ellos el afecto y el consuelo se cuentan con palabras, mirada, estar al lado, un objeto compartido, una sonrisa o un saludo con la mano a distancia. Chocar los cinco o los puños solo entre chicos de edades parecidas, nunca con un adulto que no sea de la familia (con un docente, profesional o entrenador no hay contacto de ningún tipo). Con la familia que nombra el pedido (mamá, papá, abuelos, hermanos), el cariño es bienvenido y le da calidez al libro: un abrazo, ir de la mano, upa, sentarse juntos a leer, un beso en la frente o en la mejilla, contados con lo que siente («mamá lo abrazó y olía a pan recién hecho»). A la hora de dormir, mamá o papá lo arropan sentados al lado de la cama. Un familiar que el pedido no nombra no aparece. Un chico que quiere un abrazo lo pide («¿me das un abrazo?») y el otro puede decir que no. Nunca besos en la boca, cosquillas ni secretos entre un adulto y el chico.';

/**
 * Poses (DECISIONS 312): un gusto como «vertical puente» o «gimnasia» no se cuenta con poses
 * invertidas ni de arqueo, ni se usa como herramienta para resolver la trama.
 */
export const POSE_STORY_RULE =
  '- Poses: el texto nunca pide ni cuenta puentes, verticales, volteretas, ruedas ni poses con la cabeza hacia abajo o el cuerpo arqueado. Si un gusto del protagonista es la gimnasia o el baile, se cuenta con lo que siente y con algo seguro y de pie (equilibrio en un pie, una cinta, estirarse a un costado, un salto corto). Un gusto es un detalle en una o dos escenas, nunca la herramienta que resuelve el desafío ni el centro de la trama.';

/**
 * Fantasía imitable (DECISIONS 315): «la burbuja que deja respirar bajo el agua» en un cuento para
 * una nena de 3 años. Un chico chico puede tomar literal un poder mágico y querer probarlo.
 */
export const FANTASY_STORY_RULE =
  '- Fantasía: si el protagonista tiene un poder mágico que en la vida real sería peligroso (respirar bajo el agua, volar, saltar desde alturas, no quemarse con el fuego, cruzar solo la calle, comer o probar cosas desconocidas, irse con un desconocido), el texto lo marca como magia del cuento («con la burbuja mágica», «en este cuento», «de mentira, jugando») y la última página vuelve a la vida real con un adulto cerca (en el agua, mamá o papá al lado). Nunca lo cuenta como algo que el chico pueda hacer solo.';

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
    // Calidez (juez comprador, 25 nov 2026): los libros mejor puntuados tienen un vínculo, un objeto
    // querido que vuelve y un cierre tierno y concreto.
    '- Calidez: el libro tiene un vínculo (la familia que nombra el pedido, la mascota o el amigo) y un objeto o un gesto querido que aparece al principio y vuelve al final. El final cierra con calidez concreta (lo que siente el protagonista y un momento tierno con quien lo acompaña), no con un resumen, y deja ganas de releerlo.',
    '- Lógica: todo lo que pasa tiene sentido físico y un motivo (un castillo enorme no llega a las rodillas; nada aparece sin explicación) y cada persona se nombra siempre con el mismo género («la doctora» en todas las páginas si es mujer).',
    TOUCH_STORY_RULE,
    '- Cada objeto o lugar importante se llama siempre igual y es el mismo en todas las páginas: una sola metáfora central, no varias. Lo mismo con lo que lleva el protagonista: si son anteojos, siempre «anteojos» (o «glasses»), sin sinónimos para no repetir.',
    '- El protagonista nunca hace como algo bueno lo que un chico podría imitar y lastimarse (saltar en la cama para alcanzar algo, pararse sobre una silla o un sillón, trepar muebles o estantes, hacer la vertical, el puente, la voltereta o cualquier pose invertida o de arqueo, meterse en terrenos ajenos, saltar o lanzarse hacia una ventana, un balcón o una altura). Si el cuento lo muestra, es para que un adulto ayude o para buscar otra forma.',
    POSE_STORY_RULE,
    FANTASY_STORY_RULE,
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
      '- Nombra la emoción con una palabra simple de su edad y con una señal del cuerpo (por ejemplo, «estoy nerviosa» y «el corazón me late rápido»); nunca palabras de adulto como «abrumada», «ansiedad» o «alivio enorme».',
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
    // Revisión de «El diario de Luli» (DECISIONS 328): valen para todos los cuentos.
    '- Todo personaje que aparece solo, por su cuenta, en más de una página tiene nombre propio y se lo llama por su nombre (nunca «mi compañero», «él» o «el amigo» en lugar del nombre); usa los nombres del plan. Un grupo («sus amigos», «los invitados») puede ir sin nombres.',
    '- Ninguna expresión se repite en el libro: cada emoción se cuenta con palabras distintas, y con el vocabulario de un chico de la edad del lector (nada de «vulnerabilidad», «euforia» ni «experimenté»).',
    '- Si el cuento avanza por días o momentos, cada página es un momento nuevo: no se repite el mismo día ni la misma escena en dos páginas seguidas.',
    '- Si el protagonista se pone ropa especial (una malla, un disfraz, un uniforme), el texto lo dice en cada página donde la lleva.',
  ];
  rules.push(
    `- Nunca narres en segunda persona: el narrador no le habla al lector ni a ${childName} (nada de «tú», «vos», «you», «mirá» ni imperativos fuera de un diálogo). Aunque el cuento sea para un bebé, narra en tercera persona o, si le queda bien, en primera con la voz de ${childName}.`,
  );
  if (!baby) {
    rules.push(
      `- Como máximo dos intentos fallidos antes de lograrlo, y cada uno enseña algo distinto que ${childName} usa después.`,
      `- Si hay un mentor o un adulto, ayuda o da una pista, pero la solución final la encuentra ${childName}.`,
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
  'the same outfit as in the reference sheet on every page, unless the scene to draw says the character wears something else or the action is impossible in it, such as swimming or sleeping';

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
  // El peinado de la ficha (trenzas, colita, rodete): el formulario solo da largo, tipo y color, y
  // la lámina salía con el pelo suelto (diario, ronda 4, 26 nov, DECISIONS 345).
  // Si el adulto eligió un peinado en el formulario, ese manda (ya viene en el pelo de los rasgos).
  const hairstyle = traits.hairStyle ? null : hairstyleOf(sheet.hair);
  const style = hairstyle ? `; hairstyle: ${hairstyle} (draw exactly this hairstyle)` : '';
  return `${name}: ${ageLabel(age)} (${storyAgeRule(age)}); ${describeTraits(traits, mustKeep)}${style}; outfit: ${ageLabel(age)}'s version of ${sheet.clothing} (${SAME_OUTFIT}); ${NO_PHOTO_ACCESSORIES}${extras}`;
}

/** Palabras de un peinado (no de largo, tipo o color, que ya da el formulario). */
const HAIRSTYLE_WORDS =
  /braid|plait|ponytail|pony tail|pigtail|bun\b|buns\b|top ?knot|chignon|fringe|bangs|side part|parted|afro puff|cornrow|dreadlock|locs\b|bob\b|pixie|mohawk|undercut|tied|clip|headband|bow\b|ribbon|scrunchie/i;

/** La ficha del pelo si dice un peinado; null si solo repite largo, tipo y color. */
export function hairstyleOf(hair: string): string | null {
  const text = hair.trim();
  return text && HAIRSTYLE_WORDS.test(text) ? text : null;
}

/**
 * Protagonista desde la ficha visual fija tomada de la lámina aprobada (DECISIONS 345). Reemplaza a
 * `describeCharacter` en la tapa y las páginas: una sola versión del personaje, la que se ve, sin el
 * pelo del formulario que contradecía a la lámina. Piel y ojos siguen del formulario confirmado.
 */
export function describeLookCharacter(
  name: string,
  age: number,
  look: CharacterLook,
  traits: CharacterTraits,
): string {
  const confirmed = avatarToSheet(traits, age);
  const marks = look.marks.filter((mark) => mark.trim());
  return [
    `${name}: ${ageLabel(age)} (${storyAgeRule(age)}; on the reference sheet: ${look.apparentAge})`,
    `hair: ${look.hair}`,
    `skin tone: ${confirmed.skinTone}`,
    `eyes: ${confirmed.eyes}`,
    look.glasses ? 'wears clear prescription glasses (never sunglasses)' : 'no glasses',
    marks.length ? `always visible: ${marks.join(', ')}` : '',
    `everyday outfit (exactly as on the reference sheet): ${everydayOutfit(look)}`,
    NO_PHOTO_ACCESSORIES,
  ]
    .filter(Boolean)
    .join('; ');
}

/** La ropa de todos los días de la ficha, prenda por prenda. */
export function everydayOutfit(look: CharacterLook): string {
  return look.outfit
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

/** Lo que la revisión de cada página compara con la ficha visual fija (las mismas palabras). */
export function lookMustKeep(look: CharacterLook, traits: CharacterTraits): string[] {
  const confirmed = avatarToSheet(traits, 0);
  return [
    `hair and hairstyle: ${look.hair}`,
    `skin tone: ${confirmed.skinTone}`,
    `glasses: ${look.glasses ? 'present' : 'absent'}`,
    ...look.marks.filter((mark) => mark.trim()).map((mark) => `always visible: ${mark}`),
    `outfit: ${everydayOutfit(look)} (unless the scene plan gives this page another outfit)`,
  ];
}

/**
 * La ropa de UNA página, en una sola frase y sin «salvo que» (DECISIONS 345): la especial del plan
 * (en el agua, en el espacio) o, si no hay, exactamente la de la ficha. Con «salvo que» el modelo
 * cambiaba la ropa sin motivo en 5 de 8 libros (ronda 4, 26 nov).
 */
export function pageOutfitNote(
  bible: VisualBible | null | undefined,
  scene: ScenePlan | null | undefined,
  look: CharacterLook | null | undefined,
): string {
  const special = sceneOutfit(bible, scene);
  if (special) return ` On this page the main character wears ${special}.`;
  if (look) {
    return ` On this page the main character wears exactly the everyday outfit of the reference sheet: ${everydayOutfit(look)}; no other clothes, no extra layers.`;
  }
  return ` The main character wears ${SAME_OUTFIT}.`;
}

/** Lo mínimo del plan que necesita la portada: sus lugares y la escena de cada página. */
export type CoverPlan =
  (Pick<StoryPlan, 'places' | 'scenes'> & Partial<Pick<StoryPlan, 'outfits'>>) | null | undefined;

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
 * Ropa de la portada (DECISIONS 315, pedido de Angelica: la tapa con remera a rayas y las 10
 * páginas con malla amarilla). Si la ropa especial del plan (en el agua, de noche) vale para la
 * mitad o más de las escenas, la portada la lleva también: la nena es la misma de la tapa a la
 * última página. Si no, la portada usa la ropa de la lámina como siempre (null).
 */
export function coverOutfit(plan: CoverPlan): string | null {
  const scenes = plan?.scenes ?? [];
  const outfits = (plan?.outfits ?? []).filter((item) => item.look.trim() && item.context.trim());
  if (scenes.length === 0 || outfits.length === 0) return null;
  const count = (context: string) =>
    scenes.filter((scene) => scene.outfit && sameName(scene.outfit, context)).length;
  const main = outfits.toSorted((a, b) => count(b.context) - count(a.context))[0];
  if (!main || count(main.context) * 2 < scenes.length) return null;
  return `${main.look} (${main.context}; the same look on every page in this context)`;
}

/**
 * Ropa sin huecos (DECISIONS 318, Angelica: malla en las páginas 6 y 9 y remera a rayas en la 7 y
 * la 8, bajo el agua). Una escena sin ropa especial entre dos escenas con la misma ropa especial la
 * hereda: nadie se cambia y vuelve a cambiarse sin que el texto lo diga. Devuelve las escenas
 * nuevas y las páginas que cambiaron.
 */
export function fillOutfitGaps<T extends { pageIndex: number; outfit?: string | null }>(
  scenes: readonly T[],
): { scenes: T[]; filled: number[] } {
  const result = scenes.map((scene) => ({ ...scene }));
  const filled: number[] = [];
  for (let i = 0; i < result.length; i += 1) {
    if (result[i]?.outfit) continue;
    const before = result.slice(0, i).findLast((scene) => scene.outfit)?.outfit;
    const after = result.slice(i + 1).find((scene) => scene.outfit)?.outfit;
    if (before && after && sameName(before, after)) {
      const scene = result[i];
      if (scene) {
        scene.outfit = before;
        filled.push(scene.pageIndex);
      }
    }
  }
  return { scenes: result, filled };
}

/**
 * Objetos de la portada (Angelica: la tapa nadando libre y el interior siempre dentro de una
 * burbuja). Un objeto de la biblia visual que aparece en la mitad o más de las escenas va también
 * en la tapa, igual que adentro. Null si ninguno se repite tanto.
 */
export function coverProps(
  plan: (CoverPlan & Partial<Pick<StoryPlan, 'props'>>) | null | undefined,
): string | null {
  const scenes = plan?.scenes ?? [];
  const props = (plan?.props ?? []).filter((item) => item.name.trim() && item.look.trim());
  if (scenes.length === 0 || props.length === 0) return null;
  const count = (name: string) =>
    scenes.filter((scene) => (scene.props ?? []).some((item) => sameName(item, name))).length;
  const main = props.filter((item) => count(item.name) * 2 >= scenes.length);
  return main.length > 0 ? main.map((item) => `${item.name} (${item.look})`).join('; ') : null;
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
  outfit?: string | null,
  props?: string | null,
): string {
  const recurring = props
    ? ` The cover shows the main character with ${props}, exactly as on most inside pages: the cover and the pages tell the same story.`
    : '';
  const clothes = outfit
    ? ` Clothing: the main character wears ${outfit} on the cover too, exactly as on the inside pages; this replaces the everyday outfit of the reference sheet.`
    : '';
  const concept = title
    ? ` It should evoke the book's title (“${title}”) through the scene itself, as a picture only: never draw the title or any letters.`
    : '';
  const place = setting
    ? ` Setting: ${setting}. Use only places and objects from the story; never invent new landscapes or locations.`
    : firstScene
      ? ` Story world, for the setting and mood only; do not copy this composition: ${firstScene.trim().replace(/\.+$/, '')}. Use only places from the story; never invent new landscapes.`
      : '';
  return `Book cover illustration: the main character large and centered in one of the story's own places, caught in the middle of the story's central activity or its happiest moment, with genuine emotion and body language (never the stiff standing pose of the reference sheet), with a clear focal point and a different composition from the first page. Besides the main character, only the companion or the named characters of the story may appear (a party book may show its guests): no teachers, classmates, staff, crowds or passers-by who are not named.${place}${clothes}${recurring}${concept} Draw it with exactly the same art technique, line, texture, color treatment and character proportions as the inside pages and the reference sheet: the cover is never more stylized, more inked or more dramatic than the pages. Keep the top 40% as calm, simple background with no lettering and no head or face in it: the title is typeset there later.`;
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

const plainText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Edad que el pedido da para una persona (Clara, la hermana «de 7», salió de 14 en el libro de
 * selva del 25 nov 2026): se busca cerca de su nombre en los campos del pedido. Sin número, null.
 */
export function statedAge(
  name: string | null | undefined,
  sources: readonly (string | null | undefined)[],
): number | null {
  const target = plainText(name?.trim() ?? '');
  if (!target) return null;
  for (const source of sources) {
    const text = plainText(source ?? '');
    const at = text.indexOf(target);
    if (at < 0) continue;
    // Hasta la próxima persona («Pancho y su hermana Clara, de 7»: los 7 no son del perro).
    const near =
      text
        .slice(at + target.length, at + target.length + 60)
        .split(/\s(?:y|e|and|con|with)\s|[.;]/)[0] ?? '';
    const match =
      /\b(\d{1,2})\s*(?:anos|anitos|years?|-year)/.exec(near) ?? /\bde (\d{1,2})\b/.exec(near);
    const age = match ? Number(match[1]) : NaN;
    if (Number.isFinite(age) && age >= 0 && age < 18) return age;
  }
  return null;
}

/**
 * El aspecto fijo del acompañante con la edad que dio el pedido: reemplaza otra edad o
 * «teenager» del plan y la deja al principio, para la lámina y cada página.
 */
export function withStatedAge<T extends { name: string; look: string }>(
  companion: T,
  age: number | null,
): T {
  if (age === null) return companion;
  const years = String(age);
  const look = companion.look
    .replace(/\b\d{1,2}[- ]years?[- ]old\b/gi, `${years}-year-old`)
    .replace(/\b(?:about|around|aged?) \d{1,2}\b/gi, `aged ${years}`)
    .replace(/\bteen(?:age|ager)?s?\b/gi, 'child');
  const child = age < 13 ? ', a child, never drawn as a teenager or an adult' : '';
  return {
    ...companion,
    look: `exactly ${years} years old (the height, face and body proportions of that age${child}); ${look}`,
  };
}

/** Lo que se suma a la descripción del personaje cuando el libro tiene acompañante. */
export const companionNote = (companion: { name: string; look: string }) =>
  `Recurring companion ${companion.name}: ${companion.look}. Whenever ${companion.name} appears, draw them identical to the second reference image, never changing their species, size or nature (an animal stays an animal, never a person).`;

/**
 * Personas secundarias que se repiten, para la ilustración de cada página: mismo género y aspecto
 * en todas, y solo se dibujan si la escena las incluye.
 */
export function castNote(cast: readonly CastMember[] | null | undefined): string {
  const members = (cast ?? []).filter((member) => member.role.trim() && member.look.trim());
  if (members.length === 0) return '';
  const lines = members.map((member) => {
    const gender = member.gender === 'unspecified' ? '' : `${member.gender}, `;
    const name = member.name?.trim() ? `${member.name.trim()}, ` : '';
    return `${name}${member.role}: ${gender}${member.look}`;
  });
  return ` Recurring supporting characters (draw each one with exactly the same gender, hairstyle, clothes and look on every page where the scene includes them, even when the protagonist changes clothes; never add them to scenes that do not include them): ${lines.join('; ')}.`;
}

/** Biblia visual del libro (plan): objetos, lugares y ropa con aspecto fijo. */
export type VisualBible = Pick<StoryPlan, 'props' | 'places' | 'outfits'>;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * El baño (DECISIONS 349, medición del 26 nov): con la ropa del plan el chico salía en la bañera con
 * la toalla con capucha o con la manga del pijama, y la revisión lo reprobaba. En el agua va sin ropa
 * y sin toalla, tapado por la espuma hasta los hombros, a la altura de los ojos y sin primer plano
 * del cuerpo (las mismas reglas de pudor que el resto del libro).
 */
export const BATH_OUTFIT =
  'nothing but the bath foam: sitting in the bathtub with thick white foam up to the shoulders, only the head, shoulders and arms above the bubbles; no clothes, no pajamas and no towel in the water (bath; drawn at eye level from a normal distance, never a close-up of the body; this replaces the everyday outfit of the reference sheet on this page)';

/** Palabras de estar dentro del agua del baño (no «ir al baño»). */
const BATH_WORDS =
  /\b(bath|bathtub|bathtime|bubble bath|banera|banadera|tina|banheira|banho)\b|\bin the tub\b/;

const foldText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * ¿La escena pasa dentro de la bañera? Se mira la ropa que pidió el plan y lo que tiene que verse;
 * «bathroom» y «baño» solos no cuentan (secarse o lavarse los dientes no es estar en el agua).
 */
export function isBathScene(
  scene: Pick<ScenePlan, 'outfit' | 'mustBeVisible'> | null | undefined,
): boolean {
  if (!scene) return false;
  if (scene.outfit && BATH_WORDS.test(foldText(scene.outfit))) return true;
  return scene.mustBeVisible.some((item) => {
    const text = foldText(item);
    return (
      BATH_WORDS.test(text) &&
      /\b(in|inside|en|dentro|na|no)\b/.test(text) &&
      !/\b(towel|toalla|toalha|dried|drying|secand|secarse|out of|sale de|saiu)\b/.test(text)
    );
  });
}

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
  // En la bañera la ropa es siempre la misma y no la inventa el plan (DECISIONS 349).
  if (isBathScene(scene)) return BATH_OUTFIT;
  const context = scene?.outfit;
  if (!context) return null;
  const outfit = (bible?.outfits ?? []).find(
    (item) => item.look.trim() && sameName(item.context, context),
  );
  return outfit
    ? `${outfit.look} (${outfit.context}; the same look on every page in this context; this replaces the everyday outfit of the reference sheet on this page)`
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
