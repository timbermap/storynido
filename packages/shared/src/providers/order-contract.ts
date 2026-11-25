/**
 * Contrato del pedido (DECISIONS 333): cada pedido se convierte en cláusulas verificables, armadas
 * solo con lo que pidió el formulario, lo que promete la plantilla y las reglas fijas de la casa.
 *
 * Hasta acá todos los controles comparaban el libro contra sus propios borradores (el plan, la
 * biblia visual, la lámina). Si el plan inventaba un papá, todo lo que seguía era coherente con ese
 * error y pasaba. El contrato se arma antes del plan y se controla después del plan, del texto y de
 * cada imagen. Cada fallo nuevo se suma como una cláusula, un caso del golden set y un test.
 *
 * Este archivo no llama a la IA: arma el contrato y hace los controles de código. Las cláusulas que
 * solo puede ver un juez (ropa, estilo, contacto en el dibujo) quedan declaradas con `judge`.
 */
import type { Locale } from '../i18n';

import type { StoryPlan } from './ai';
import {
  REFRAIN_MIN,
  diaryHeadingIssues,
  hasTouch,
  refrainPages,
  type CraftPage,
} from './story-checks';

export const CONTRACT_CLAUSES = [
  /** Solo aparecen el protagonista y los personajes que el pedido nombra o la plantilla trae. */
  'closed_cast',
  /** Sin contacto físico; con la familia, solo si el pedido trae a esa persona. */
  'no_touch',
  /** El estribillo del plan, idéntico, en varias páginas. */
  'exact_refrain',
  /** La mascota y el mejor amigo cargados en el formulario aparecen con su nombre. */
  'requested_names',
  /** Los gustos cargados se notan en el cuento (blanda: la idea de la ficha manda, DEC 277). */
  'likes_present',
  /** Lo que promete la plantilla: encabezados del Diario y, cuando exista, el sonido objetivo. */
  'template_promise',
  /** La edad del chico entra en el rango de la plantilla (blanda: hay plantillas que se adaptan). */
  'age_range',
  /** La misma ropa de la lámina en todas las páginas (juez de imagen). */
  'same_outfit',
  /** La técnica elegida (Manga es manga): juez de imagen y chequeo de píxeles (DEC 282). */
  'chosen_style',
  /** Sin letras dentro de la ilustración (revisión de página). */
  'no_text_in_image',
] as const;

export type ContractClauseId = (typeof CONTRACT_CLAUSES)[number];

export const CONTRACT_STAGES = ['form', 'plan', 'text', 'image'] as const;
export type ContractStage = (typeof CONTRACT_STAGES)[number];

export type ContractSeverity = 'hard' | 'soft';

/** Nombres cortos para el admin (Calidad y «Reportar fallo»). */
export const CONTRACT_CLAUSE_LABELS: Record<ContractClauseId, string> = {
  closed_cast: 'Personajes no pedidos',
  no_touch: 'Contacto físico',
  exact_refrain: 'Estribillo cambiado',
  requested_names: 'Falta la mascota o el amigo',
  likes_present: 'No aparecen los gustos',
  template_promise: 'No cumple la plantilla',
  age_range: 'Plantilla fuera de la edad',
  same_outfit: 'Ropa que cambia',
  chosen_style: 'Estilo distinto al elegido',
  no_text_in_image: 'Letras en el dibujo',
};

export interface ContractClause {
  id: ContractClauseId;
  /** De dónde sale: el formulario, la plantilla, el plan aprobado o una regla fija. */
  source: 'form' | 'template' | 'plan' | 'house';
  stages: readonly ContractStage[];
  /** Cómo se controla: código (gratis), juez (IA) o los dos. */
  checkedBy: 'code' | 'judge' | 'both';
  /** Dura: se repara antes de entregar. Blanda: se registra para medirla. */
  severity: ContractSeverity;
  /** La regla en una frase, para el escritor, el juez y el admin. */
  rule: string;
}

export interface ContractTemplatePromise {
  id: 'diary_headings' | 'practice_sound';
  rule: string;
  /** practice_sound: lo que eligió el profesional («rr», «la s», «palabras con m»). */
  practice?: string;
}

export interface OrderContract {
  clauses: ContractClause[];
  /** Roles de familia que el pedido o la plantilla traen (los demás no pueden aparecer). */
  allowedFamily: FamilyRole[];
  /** Nombres del formulario que tienen que aparecer (mascota, mejor amigo). */
  requiredNames: string[];
  likes: string[];
  promises: ContractTemplatePromise[];
  language: Locale;
}

export interface OrderContractInput {
  channel: 'families' | 'events' | 'professionals';
  language: Locale;
  age: number;
  petName?: string | null;
  bestFriendName?: string | null;
  likes?: readonly string[];
  /** Profesionales: el sonido o las palabras para practicar (DECISIONS 332, `book.practice`). */
  practice?: string | null;
  /** Rango de edad de la plantilla. */
  storyAges?: { min: number; max: number } | null;
  tags?: readonly string[];
  /**
   * Todo lo que el adulto escribió o eligió y la plantilla dice: recuerdos, dedicatoria, mensaje
   * propio, prompt y resumen de la ficha. De acá salen los familiares permitidos.
   */
  requestedText: readonly (string | null | undefined)[];
}

/** Familiares que un cuento no puede sumar si nadie los pidió (DEC 333, papá de Angélica). */
export const FAMILY_ROLES = ['mother', 'father', 'grandparent', 'sibling', 'aunt_uncle'] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

/** En minúsculas y sin tildes (como `fold`). */
const FAMILY_PATTERNS: Record<FamilyRole, RegExp> = {
  mother: /\b(mama|mami|mamita|madre|mom|mommy|mum|mummy|mother|mae|mamae|mainha)\b/,
  father: /\b(papa|papi|papito|padre|dad|daddy|father|pai|papai|painho)\b/,
  grandparent:
    /\b(abuel[oa]s?|abu|nona|nono|grand(ma|pa|mother|father|parents?)|granny|grandpa|av[oó]s?|vov[oó]|vo)\b/,
  sibling: /\b(herman[oa]s?|hermanit[oa]s?|brother|sister|irm[aã]o?s?|irmazinha|irmaozinho)\b/,
  aunt_uncle: /\b(ti[ao]s?|aunt|auntie|uncle)\b/,
};

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Para comparar frases: sin tildes, sin signos y con un solo espacio. */
const bare = (value: string) =>
  fold(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Roles de familia que nombra un texto. */
export function familyRolesIn(text: string): FamilyRole[] {
  const folded = fold(text);
  return FAMILY_ROLES.filter((role) => FAMILY_PATTERNS[role].test(folded));
}

/** Arma el contrato con el pedido, la plantilla y las reglas fijas. No llama a la IA. */
export function buildOrderContract(input: OrderContractInput): OrderContract {
  const allowedFamily = [
    ...new Set(input.requestedText.flatMap((text) => (text ? familyRolesIn(text) : []))),
  ];
  const requiredNames = [input.petName, input.bestFriendName]
    .map((name) => name?.trim() ?? '')
    .filter((name) => name.length > 0);
  const likes = (input.likes ?? []).map((like) => like.trim()).filter(Boolean);
  const promises: ContractTemplatePromise[] = [];
  if (input.tags?.includes('diario')) {
    promises.push({
      id: 'diary_headings',
      rule: 'Cada entrada del diario empieza con su encabezado propio (momento del año y título).',
    });
  }
  const practice = input.practice?.trim();
  if (practice) {
    promises.push({
      id: 'practice_sound',
      rule: `El sonido para practicar («${practice}») aparece en palabras de al menos la mitad de las páginas con texto.`,
      practice,
    });
  }
  // En un libro para un paciente o un alumno, un familiar inventado es un riesgo: el profesional
  // no sabe con quién vive el chico. En familias y celebraciones se registra para medirlo.
  const castSeverity: ContractSeverity = input.channel === 'professionals' ? 'hard' : 'soft';
  const clauses: ContractClause[] = [
    {
      id: 'closed_cast',
      source: 'form',
      stages: ['plan', 'text', 'image'],
      checkedBy: 'both',
      severity: castSeverity,
      rule:
        allowedFamily.length > 0
          ? 'Solo aparecen el protagonista, los personajes del pedido y la familia que el pedido nombra.'
          : 'Solo aparecen el protagonista y los personajes del pedido: ningún familiar que nadie pidió.',
    },
    {
      id: 'no_touch',
      source: 'house',
      stages: ['text', 'image'],
      checkedBy: 'both',
      severity: 'hard',
      rule: 'Sin abrazos, besos, brazos ni regazo; con la familia del pedido, solo un abrazo breve de costado.',
    },
    {
      id: 'requested_names',
      source: 'form',
      stages: ['text'],
      checkedBy: 'code',
      severity: 'hard',
      rule: 'La mascota y el mejor amigo del formulario aparecen con su nombre, tal cual.',
    },
    {
      id: 'likes_present',
      source: 'form',
      stages: ['text'],
      checkedBy: 'code',
      severity: 'soft',
      rule: 'Al menos uno de los gustos cargados se nota en el cuento.',
    },
    {
      id: 'exact_refrain',
      source: 'plan',
      stages: ['text'],
      checkedBy: 'code',
      severity: 'hard',
      rule: 'El estribillo del plan se repite idéntico, letra por letra, en varias páginas.',
    },
    {
      id: 'age_range',
      source: 'template',
      stages: ['form'],
      checkedBy: 'code',
      severity: 'soft',
      rule: 'La edad del chico entra en el rango de la plantilla.',
    },
    {
      id: 'same_outfit',
      source: 'house',
      stages: ['image'],
      checkedBy: 'judge',
      severity: 'hard',
      rule: 'La misma ropa de la lámina en la tapa y en todas las páginas.',
    },
    {
      id: 'chosen_style',
      source: 'form',
      stages: ['image'],
      checkedBy: 'both',
      severity: 'hard',
      rule: 'Todas las ilustraciones en la técnica elegida.',
    },
    {
      id: 'no_text_in_image',
      source: 'house',
      stages: ['image'],
      checkedBy: 'judge',
      severity: 'hard',
      rule: 'Sin letras ni palabras dentro de la ilustración.',
    },
  ];
  if (promises.length > 0) {
    clauses.push({
      id: 'template_promise',
      source: 'template',
      stages: ['text'],
      checkedBy: 'code',
      severity: 'hard',
      rule: promises.map((promise) => promise.rule).join(' '),
    });
  }
  return {
    clauses,
    allowedFamily,
    requiredNames,
    likes,
    promises,
    language: input.language,
  };
}

export interface ContractViolation {
  clause: ContractClauseId;
  stage: ContractStage;
  severity: ContractSeverity;
  /** Páginas (1 = primera) afectadas, si aplica. */
  pages: number[];
  /** Qué arreglar, en una frase para la reescritura (sin datos del niño en el registro). */
  repair: string;
}

const severityOf = (contract: OrderContract, clause: ContractClauseId): ContractSeverity =>
  contract.clauses.find((item) => item.id === clause)?.severity ?? 'hard';

/** Familiares del texto que el pedido no trae. */
function unrequestedFamily(contract: OrderContract, text: string): FamilyRole[] {
  return familyRolesIn(text).filter((role) => !contract.allowedFamily.includes(role));
}

const ROLE_NAMES: Record<FamilyRole, string> = {
  mother: 'mamá',
  father: 'papá',
  grandparent: 'abuelos',
  sibling: 'hermanos',
  aunt_uncle: 'tíos',
};

/** La plantilla, antes de escribir: hoy solo la edad (blanda). */
export function checkFormContract(
  contract: OrderContract,
  input: { age: number; storyAges?: { min: number; max: number } | null },
): ContractViolation[] {
  const range = input.storyAges;
  if (!range || (input.age >= range.min && input.age <= range.max)) return [];
  return [
    {
      clause: 'age_range',
      stage: 'form',
      severity: severityOf(contract, 'age_range'),
      pages: [],
      repair: `La plantilla es para ${String(range.min)} a ${String(range.max)} años.`,
    },
  ];
}

/**
 * El plan contra el contrato. Devuelve los fallos y, para las cláusulas duras, el plan saneado (sin
 * los familiares que nadie pidió): se arregla gratis, antes de escribir una sola página.
 */
export function checkPlanContract(
  contract: OrderContract,
  plan: Pick<StoryPlan, 'companion' | 'cast'>,
): {
  violations: ContractViolation[];
  plan: Pick<StoryPlan, 'companion' | 'cast'>;
} {
  const companionExtra = plan.companion
    ? unrequestedFamily(contract, `${plan.companion.name} ${plan.companion.look}`)
    : [];
  const castExtra = (plan.cast ?? []).map((member) =>
    unrequestedFamily(contract, `${member.name ?? ''} ${member.role}`),
  );
  const roles = [...new Set([...companionExtra, ...castExtra.flat()])];
  if (roles.length === 0) return { violations: [], plan };
  const severity = severityOf(contract, 'closed_cast');
  const violation: ContractViolation = {
    clause: 'closed_cast',
    stage: 'plan',
    severity,
    pages: [],
    repair: `El plan suma familiares que el pedido no nombra (${roles.map((role) => ROLE_NAMES[role]).join(', ')}).`,
  };
  if (severity === 'soft') return { violations: [violation], plan };
  return {
    violations: [violation],
    plan: {
      companion: companionExtra.length > 0 ? null : (plan.companion ?? null),
      cast: (plan.cast ?? []).filter((_, index) => (castExtra[index] ?? []).length === 0),
    },
  };
}

/** Cuántas veces tiene que aparecer el estribillo idéntico (el mismo tope que la revisión, DEC 332). */
export function refrainMinPages(textPages: number): number {
  return Math.min(REFRAIN_MIN, textPages);
}

/** El texto contra el contrato: todos los controles de código, sin IA. */
export function checkTextContract(
  contract: OrderContract,
  pages: readonly CraftPage[],
  plan: Pick<StoryPlan, 'refrain' | 'structure'> | null,
): ContractViolation[] {
  const violations: ContractViolation[] = [];
  const all = pages.map((page) => page.text).join('\n');
  const textPages = pages.filter((page) => page.text.trim() !== '').length;

  const extra: number[] = [];
  const touch: number[] = [];
  pages.forEach((page, index) => {
    const unrequested = unrequestedFamily(contract, page.text);
    if (unrequested.length > 0) extra.push(index + 1);
    if (!hasTouch(page.text)) return;
    // Un abrazo solo con la familia que el pedido trae; con cualquier otro, o con un familiar que
    // nadie pidió, es contacto no pedido.
    const family = familyRolesIn(page.text);
    if (family.length === 0 || unrequested.length > 0) touch.push(index + 1);
  });
  if (extra.length > 0) {
    violations.push({
      clause: 'closed_cast',
      stage: 'text',
      severity: severityOf(contract, 'closed_cast'),
      pages: extra,
      repair: `Aparece un familiar que el pedido no nombra en la página ${extra.join(', ')}: sácalo y cuenta la escena solo con el protagonista y los personajes del pedido.`,
    });
  }
  if (touch.length > 0) {
    violations.push({
      clause: 'no_touch',
      stage: 'text',
      severity: severityOf(contract, 'no_touch'),
      pages: touch,
      repair: `Contacto físico no pedido en la página ${touch.join(', ')}: reescribe sin tocarse; el consuelo va con palabras, estar al lado o un objeto compartido, y quien atiende (dentista, médica, terapeuta) muestra, explica o alcanza una herramienta sin poner las manos sobre el chico.`,
    });
  }

  const folded = bare(all);
  const missing = contract.requiredNames.filter((name) => {
    const first = bare(name).split(' ')[0] ?? '';
    return first.length > 0 && !new RegExp(`\\b${first}\\b`, 'u').test(folded);
  });
  if (missing.length > 0) {
    violations.push({
      clause: 'requested_names',
      stage: 'text',
      severity: severityOf(contract, 'requested_names'),
      pages: [],
      repair: `Faltan personajes del pedido (${missing.map((name) => `«${name}»`).join(', ')}): súmalos con su nombre tal cual, en al menos una página, de forma natural.`,
    });
  }

  if (contract.likes.length > 0) {
    const stems = contract.likes
      .map((like) => bare(like).slice(0, 5))
      .filter((stem) => stem.length >= 3);
    if (stems.length > 0 && !stems.some((stem) => folded.includes(stem))) {
      violations.push({
        clause: 'likes_present',
        stage: 'text',
        severity: severityOf(contract, 'likes_present'),
        pages: [],
        repair: 'Ninguno de los gustos cargados se nota en el cuento.',
      });
    }
  }

  const refrain = plan?.refrain?.trim() ?? '';
  if (refrain && plan?.structure === 'refrain' && textPages > 0) {
    const found = refrainPages(pages, refrain).length;
    const needed = refrainMinPages(textPages);
    if (bare(refrain).length > 0 && found < needed) {
      violations.push({
        clause: 'exact_refrain',
        stage: 'text',
        severity: severityOf(contract, 'exact_refrain'),
        pages: [],
        repair: `El estribillo «${refrain}» tiene que repetirse idéntico, letra por letra, en al menos ${String(needed)} páginas (hoy está en ${String(found)}): no lo cambies por sinónimos.`,
      });
    }
  }

  const practice = contract.promises.find((promise) => promise.id === 'practice_sound')?.practice;
  if (practice) {
    const missing = practiceMissingPages(pages, practice);
    const needed = Math.ceil(textPages / 2);
    if (textPages > 0 && textPages - missing.length < needed) {
      violations.push({
        clause: 'template_promise',
        stage: 'text',
        severity: severityOf(contract, 'template_promise'),
        pages: missing,
        repair: `El sonido para practicar «${practice}» casi no aparece (faltan las páginas ${missing.join(', ')}): cada página con texto trae 2 o 3 palabras simples que lo contienen, y la frase que se repite también.`,
      });
    }
  }
  if (contract.promises.some((promise) => promise.id === 'diary_headings')) {
    const headings = diaryHeadingIssues(pages);
    const bad = [...headings.missing];
    if (bad.length > 0 || headings.repeated.length > 0) {
      violations.push({
        clause: 'template_promise',
        stage: 'text',
        severity: severityOf(contract, 'template_promise'),
        pages: bad,
        repair:
          'Cada entrada del diario empieza con su propio encabezado (momento del año y un título corto, separados por dos puntos), sin repetirlos.',
      });
    }
  }
  return violations;
}

/** Palabras de relleno que se sacan de lo que escribe el profesional para quedarse con el sonido. */
const PRACTICE_FILLER = new Set([
  'sonido',
  'sonidos',
  'letra',
  'letras',
  'palabra',
  'palabras',
  'con',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'sound',
  'sounds',
  'letter',
  'letters',
  'word',
  'words',
  'with',
  'the',
  'som',
  'sons',
  'letra',
  'palavras',
  'com',
  'o',
  'a',
  'os',
  'as',
  'y',
  'e',
  'and',
]);

/**
 * Páginas con texto (1 = primera) donde no aparece el sonido. Con una sola letra («s»), la página
 * necesita 2 palabras que la tengan; con más («rr», «tr», «mesa»), una que lo contenga.
 */
export function practiceMissingPages(pages: readonly CraftPage[], practice: string): number[] {
  const tokens = bare(practice)
    .split(' ')
    .filter((token) => token && !PRACTICE_FILLER.has(token));
  const target = tokens.sort((a, b) => b.length - a.length)[0] ?? '';
  if (!target) return [];
  const missing: number[] = [];
  pages.forEach((page, index) => {
    if (page.text.trim() === '') return;
    const wordsIn = bare(page.text).split(' ');
    const hits = wordsIn.filter((word) => word.includes(target)).length;
    if (hits < (target.length === 1 ? 2 : 1)) missing.push(index + 1);
  });
  return missing;
}

/** Solo las duras: las que se reparan antes de entregar. */
export const hardViolations = (violations: readonly ContractViolation[]) =>
  violations.filter((violation) => violation.severity === 'hard');

/** Cláusulas que ve el juez de imagen (la revisión de cada página). */
export const IMAGE_CONTRACT_CLAUSES = [
  'closed_cast',
  'no_touch',
  'same_outfit',
  'chosen_style',
  'no_text_in_image',
] as const satisfies readonly ContractClauseId[];

export type ImageContractClause = (typeof IMAGE_CONTRACT_CLAUSES)[number];

/**
 * El contrato en inglés para el juez de imagen (DECISIONS 333): quiénes pueden aparecer (el plan ya
 * saneado contra el pedido en la muestra) y las reglas que se miran en el dibujo. Va en la misma
 * revisión de página que ya corre, sin llamada nueva.
 */
export function imageContractNote(input: {
  companion?: { name: string; look: string } | null;
  cast?: readonly { role: string; name?: string | null }[];
  /**
   * Celebraciones: los invitados de la fiesta son un grupo sin nombre que el pedido permite
   * (golden set, 25 nov: la tapa del cumpleaños con invitados salía como elenco roto).
   */
  partyGuests?: boolean;
}): string {
  const allowed = [
    'the protagonist',
    ...(input.companion ? [`${input.companion.name} (${input.companion.look})`] : []),
    ...(input.cast ?? []).map((member) =>
      member.name ? `${member.name} (${member.role})` : member.role,
    ),
    ...(input.partyGuests
      ? ['an unnamed group of party guests (other children) in the party scenes and on the cover']
      : []),
  ];
  return [
    `Characters the customer's order allows in this book: ${allowed.join('; ')}.`,
    'closed_cast: any other clearly visible person, above all a mother, father, grandparent, sibling, aunt or uncle who is not in that list, breaks the order (a faceless crowd far in the background is fine).',
    'no_touch: physical contact between people as described above.',
    'same_outfit: the protagonist wears the outfit of the reference sheet unless the scene plan or the page text names other clothes for this scene (a helmet, a towel, pajamas).',
    'chosen_style: the illustration is drawn in the same art technique as the reference sheet.',
    'no_text_in_image: letters or words drawn in the image.',
  ].join('\n');
}
