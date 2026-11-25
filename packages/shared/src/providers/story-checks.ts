import type { Locale } from '../i18n';

/**
 * Controles deterministas del oficio del texto (sin IA): diálogo, palabras repetidas y moralejas.
 * Si alguno falla, la muestra le pide a la revisión editorial una reescritura con la lista concreta
 * de problemas (una sola pasada extra).
 */

/** Desde esta edad, al menos una de cada tres páginas tiene diálogo. */
export const DIALOGUE_MIN_AGE = 6;
export const DIALOGUE_MIN_SHARE = 1 / 3;

/** Una palabra con contenido no se repite más de 2 veces en una página. */
export const PAGE_REPEAT_MAX = 2;
/**
 * Ni más de 4 veces en el libro. En los libros largos el tope crece con las páginas (una cada tres):
 * el objeto central se llama siempre igual y en 26 páginas vuelve más de cuatro veces.
 */
export const BOOK_REPEAT_MIN = 4;

const DIALOGUE = /[—«»“”"]|(^|\s)-\s?\p{Lu}/u;

const STOPWORDS: Record<Locale, readonly string[]> = {
  es: [
    'algo alguien antes aquel aquella aquí cada casi como cómo con cuando cuándo desde después',
    'donde dónde ella ellas ellos entonces entre esta está estaba estaban estas están este esto',
    'estos hacia hasta había mientras mucho mucha muchos muy nada nadie nosotros otra otras',
    'otro otros para pero poco porque qué quién sobre también tanto todas todo todos tras una',
    'unas unos vez ese esa eso esos esas les sus tus mis nuestro nuestra ahora luego solo sólo',
    'más menos sin ser era eran fue son hay tiene tenía dijo dice cuál siempre nunca donde',
    'aunque ya así bien los las del por que con muy uno sea iba dos tan',
  ]
    .join(' ')
    .split(' '),
  en: [
    'about after again also always before could every from have into just like more never only',
    'other over said says some than that their them then there these they this very were what',
    'when where which while with would your will been each here much the and for but you was',
    'are his her she him not all can had has its our out who why how now yes did one two too',
  ]
    .join(' ')
    .split(' '),
  pt: [
    'algo alguém antes aqui cada como com quando depois onde ela elas eles então entre esta',
    'está estava este isto esse essa isso até havia enquanto muito muita nada ninguém outra',
    'outro para pelo pela porque sobre também tudo todos todas uma umas uns vez seus suas agora',
    'depois mais menos sem era foi disse sempre nunca assim bem tem tinha dos das nos nas por',
    'que mas seu sua meu minha uma ela ele num dois tão',
  ]
    .join(' ')
    .split(' '),
};

/** Moralejas explícitas: la enseñanza se muestra, no se dice (en minúsculas, sin tildes). */
const MORAL_PHRASES: Record<Locale, readonly string[]> = {
  es: [
    'perseverancia',
    'nunca rendirse',
    'nunca te rindas',
    'no rendirse',
    'aprendio que',
    'aprendio una leccion',
    'la leccion',
    'el verdadero valor',
    'la verdadera amistad',
    'la moraleja',
    'lo mas importante es',
    'comprendio que',
    'entendio que',
  ],
  en: [
    'perseverance',
    'never give up',
    'learned that',
    'learnt that',
    'the lesson',
    'the true meaning',
    'the true value',
    'the moral',
    'the most important thing is',
    'realized that',
  ],
  pt: [
    'perseverança',
    'nunca desistir',
    'nunca desista',
    'aprendeu que',
    'a lição',
    'o verdadeiro valor',
    'a moral da história',
    'o mais importante é',
    'percebeu que',
  ],
};

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const words = (text: string) => text.match(/[\p{L}\p{M}'’]+/gu) ?? [];

export interface CraftPage {
  text: string;
}

/** Páginas con texto (las que el plan deja sin texto no cuentan). */
const written = (pages: readonly CraftPage[]) => pages.filter((page) => page.text.trim() !== '');

/** Proporción de páginas con texto que tienen diálogo (raya, comillas o guion de diálogo). */
export function dialogueShare(pages: readonly CraftPage[]): number {
  const withText = written(pages);
  if (withText.length === 0) return 0;
  return withText.filter((page) => DIALOGUE.test(page.text)).length / withText.length;
}

export interface RepeatedWord {
  word: string;
  count: number;
  /** Página (1 = primera) si se repite en una sola página; null si es en todo el libro. */
  page: number | null;
}

/**
 * Palabras con contenido que se repiten demasiado: más de 2 veces en una página o más del tope del
 * libro. No cuentan las palabras vacías, las de menos de 3 letras ni los nombres de los personajes.
 */
export function repeatedWords(
  pages: readonly CraftPage[],
  options: { language: Locale; names?: readonly string[] },
): RepeatedWord[] {
  const stop = new Set(STOPWORDS[options.language].map(fold));
  const names = new Set(
    (options.names ?? []).flatMap((name) => words(name)).map((name) => fold(name)),
  );
  const keep = (word: string) => word.length >= 3 && !stop.has(word) && !names.has(word);
  const bookMax = Math.max(BOOK_REPEAT_MIN, Math.ceil(pages.length / 3));
  const book = new Map<string, number>();
  const found: RepeatedWord[] = [];
  pages.forEach((page, index) => {
    const counts = new Map<string, number>();
    for (const word of words(page.text).map(fold).filter(keep)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
      book.set(word, (book.get(word) ?? 0) + 1);
    }
    for (const [word, count] of counts) {
      if (count > PAGE_REPEAT_MAX) found.push({ word, count, page: index + 1 });
    }
  });
  for (const [word, count] of book) {
    if (count > bookMax) found.push({ word, count, page: null });
  }
  return found;
}

/** Frases de moraleja explícita que aparecen en el texto (en la forma de la lista). */
export function moralPhrases(pages: readonly CraftPage[], language: Locale): string[] {
  const text = fold(pages.map((page) => page.text).join(' \n '));
  return MORAL_PHRASES[language].filter((phrase) => text.includes(fold(phrase)));
}

/** Contacto físico en el texto (DECISIONS 294): abrazos, besos, brazos, regazo, cosquillas. */
const TOUCH_WORDS =
  /abraz|abrac|besa|beso|beij|en brazos|regazo|cosquill|\bhug|\bkiss|cuddl|\blap\b|tickl|\bcolo\b|carregou|del brazo|de la mano|\bmanos? (en|sobre) (el|la|su|mi|tu) (hombro|brazo|espalda|cabeza)|palmad|palmeo|\bhand on (his|her|my|their|your) (shoulder|arm|back|head)|\bpatted\b|took (his|her|my|their) hand|pela mao|\bmaos? no (ombro|braco)/;
/** Familia directa: con ellos un abrazo corto está permitido. */
const FAMILY_WORDS =
  /mama|papa|madre|padre|abuel|herman|\bmom|\bdad|mother|father|grand|sister|brother|\bmae\b|\bpai\b|\bavo|\bavos|irma|\bvovo/;

/** ¿El texto cuenta contacto físico (abrazo, beso, brazos, regazo, cosquillas)? */
export function hasTouch(text: string): boolean {
  return TOUCH_WORDS.test(fold(text));
}

/**
 * Nombres de otros chicos de la misma cuenta (su nombre, mascota o amigo) que aparecen en el texto
 * y que este pedido no trae (25 nov 2026: Renata y Mostaza, de Joaquín, en los libros de Valentina,
 * Ximena y Benicio). `allowed` es todo lo que el pedido y la plantilla nombran: si el nombre está
 * ahí (recuerdos, dedicatoria, plan), no cuenta. Se busca como palabra, con mayúscula, tal cual.
 */
export function foreignNames(
  pages: readonly CraftPage[],
  candidates: readonly string[],
  allowed: readonly string[],
): { name: string; pages: number[] }[] {
  const known = fold(allowed.join(' \n '));
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const seen = new Set<string>();
  const found: { name: string; pages: number[] }[] = [];
  for (const raw of candidates) {
    // «Clara, su hermana de 7» → «Clara»; con mayúscula, como va en el texto.
    const first = (raw.split(/[,;(]/)[0] ?? '').trim();
    const name = first ? first.charAt(0).toLocaleUpperCase() + first.slice(1) : '';
    if (name.length < 2 || seen.has(fold(name))) continue;
    seen.add(fold(name));
    if (new RegExp(`(^|[^\\p{L}])${escape(fold(name))}($|[^\\p{L}])`, 'u').test(known)) continue;
    const word = new RegExp(`(^|[^\\p{L}])${escape(name)}($|[^\\p{L}])`, 'u');
    const at = pages.flatMap((page, index) => (word.test(page.text) ? [index + 1] : []));
    if (at.length > 0) found.push({ name, pages: at });
  }
  return found;
}

/** Páginas (1 = primera) con contacto físico donde no aparece nadie de la familia directa. */
export function touchPages(pages: readonly CraftPage[]): number[] {
  const found: number[] = [];
  pages.forEach((page, index) => {
    const text = fold(page.text);
    if (TOUCH_WORDS.test(text) && !FAMILY_WORDS.test(text)) found.push(index + 1);
  });
  return found;
}

/**
 * Abrazos con la familia (DECISIONS 294): solo si el pedido lo pide y uno en todo el libro. El
 * libro de Angélica (25 nov 2026) terminó con «Papá me abraza fuerte» sin que nadie lo pidiera.
 */
export function familyTouchPages(pages: readonly CraftPage[]): number[] {
  const found: number[] = [];
  pages.forEach((page, index) => {
    const text = fold(page.text);
    if (TOUCH_WORDS.test(text) && FAMILY_WORDS.test(text)) found.push(index + 1);
  });
  return found;
}

/** Texto sin tildes, signos ni mayúsculas, para comparar el estribillo letra por letra. */
const plain = (value: string) => words(fold(value)).join(' ');

/**
 * Páginas (1 = primera) donde el estribillo del plan aparece igual. En el libro de Angélica la
 * reescritura por largo lo cambió por «Escucho, escucho» y «Presto oído» (25 nov 2026).
 */
export function refrainPages(
  pages: readonly CraftPage[],
  refrain: string | null | undefined,
): number[] {
  const target = plain(refrain ?? '');
  if (!target) return [];
  return pages.flatMap((page, index) => (plain(page.text).includes(target) ? [index + 1] : []));
}

/** Veces que el estribillo tiene que aparecer igual (o en todas las páginas, si son menos). */
export const REFRAIN_MIN = 3;

/**
 * Emociones que se repiten con la misma frase (DECISIONS 329: «alivio enorme» varias veces en el
 * diario de Luli). Dos palabras seguidas con contenido, una de ellas de emoción o del cuerpo, en dos
 * páginas o más. No cuentan las de la frase que se repite a propósito (el estribillo).
 */
const EMOTION_STEMS: Record<Locale, readonly string[]> = {
  es: [
    'alivi',
    'mied',
    'nervi',
    'corazon',
    'rodill',
    'estomag',
    'panz',
    'sonris',
    'feliz',
    'content',
    'orgull',
    'emocion',
    'trist',
    'enorme',
    'gigant',
    'temblab',
    'latia',
    'lagrim',
    'verguenz',
    'calor',
    'cosquill',
    'suspir',
  ],
  en: [
    'relie',
    'scare',
    'afraid',
    'nervous',
    'heart',
    'knees',
    'stomach',
    'tummy',
    'smil',
    'happy',
    'proud',
    'excit',
    'sad',
    'huge',
    'giant',
    'trembl',
    'pound',
    'tear',
    'embarrass',
    'sigh',
  ],
  pt: [
    'alivi',
    'medo',
    'nervos',
    'coracao',
    'joelh',
    'estomag',
    'barrig',
    'sorris',
    'feliz',
    'content',
    'orgulh',
    'emoc',
    'trist',
    'enorme',
    'gigant',
    'trem',
    'lagrim',
    'vergonh',
    'suspir',
  ],
};

export function repeatedPhrases(
  pages: readonly CraftPage[],
  options: { language: Locale; names?: readonly string[]; refrain?: string | null },
): string[] {
  const stop = new Set(STOPWORDS[options.language].map(fold));
  const names = new Set((options.names ?? []).flatMap((name) => words(name)).map(fold));
  const refrain = fold(options.refrain ?? '');
  const stems = EMOTION_STEMS[options.language];
  const content = (word: string) => word.length >= 3 && !stop.has(word) && !names.has(word);
  const seen = new Map<string, Set<number>>();
  pages.forEach((page, index) => {
    const list = words(page.text).map(fold);
    for (let i = 0; i + 1 < list.length; i += 1) {
      const [a, b] = [list[i] ?? '', list[i + 1] ?? ''];
      if (!content(a) || !content(b)) continue;
      if (!stems.some((stem) => a.startsWith(stem) || b.startsWith(stem))) continue;
      const phrase = `${a} ${b}`;
      if (refrain.includes(phrase)) continue;
      seen.set(phrase, (seen.get(phrase) ?? new Set()).add(index));
    }
  });
  return [...seen].filter(([, on]) => on.size >= 2).map(([phrase]) => phrase);
}

/** Palabras de adulto en un cuento para chicos (DECISIONS 329), en minúsculas y sin tildes. */
const ADULT_WORDS: Record<Locale, readonly string[]> = {
  es: [
    'vulnerabilidad',
    'euforia',
    'experimente',
    'experimentaba',
    'abrumad',
    'melancol',
    'nostalgia',
    'inefable',
    'efimer',
    'sobremanera',
    'sumamente',
    'desasosiego',
    'consternad',
    'introspecc',
  ],
  en: [
    'vulnerability',
    'euphoria',
    'overwhelmed',
    'melanchol',
    'nostalgi',
    'ineffable',
    'ephemeral',
    'exceedingly',
    'consternation',
    'introspect',
  ],
  pt: [
    'vulnerabilidade',
    'euforia',
    'experimentei',
    'sobrecarregad',
    'melancol',
    'nostalgia',
    'inefavel',
    'efemer',
    'sobremaneira',
    'introspec',
  ],
};

export function adultWords(pages: readonly CraftPage[], language: Locale): string[] {
  const list = new Set(pages.flatMap((page) => words(page.text).map(fold)));
  return ADULT_WORDS[language].filter((stem) => [...list].some((word) => word.startsWith(stem)));
}

/**
 * Un amigo que vuelve sin nombre (DECISIONS 329): «mi compañero» o «el amigo» en dos páginas o más.
 */
const UNNAMED_FRIEND: Record<Locale, RegExp> = {
  es: /(?:^|[^\p{L}])(?:[Mm]i|[Ee]l|[Ll]a|[Ss]u|[Tt]u) (?:amig[oa]|compañer[oa])(?![\p{L}])(?!,? (?:\p{Lu}|de |y ))/u,
  en: /(?:^|[^\p{L}])(?:[Mm]y|[Tt]he|[Hh]is|[Hh]er|[Tt]heir) (?:new )?(?:friend|classmate)(?![\p{L}])(?!,? (?:\p{Lu}|and |of ))/u,
  pt: /(?:^|[^\p{L}])(?:[Mm]eu|[Mm]inha|[Oo]|[Aa]|[Ss]eu|[Ss]ua) (?:amig[oa]|colega)(?![\p{L}])(?!,? (?:\p{Lu}|de |e ))/u,
};

export function unnamedFriendPages(pages: readonly CraftPage[], language: Locale): number[] {
  const found: number[] = [];
  pages.forEach((page, index) => {
    if (UNNAMED_FRIEND[language].test(page.text)) found.push(index + 1);
  });
  return found.length >= 2 ? found : [];
}

/**
 * Diario (DECISIONS 330): cada entrada empieza con su encabezado «momento: título» y ningún
 * encabezado se repite. En la prueba del 25 nov las entradas salieron sin encabezado y nada lo
 * marcaba. Devuelve las páginas sin encabezado y los encabezados repetidos.
 */
const DIARY_HEADING = /^\s*([^\n:—«»"]{3,60}):\s*\S/u;

export function diaryHeadingIssues(pages: readonly CraftPage[]): {
  missing: number[];
  repeated: string[];
} {
  const missing: number[] = [];
  const seen = new Map<string, number>();
  pages.forEach((page, index) => {
    if (page.text.trim() === '') return;
    const heading = DIARY_HEADING.exec(page.text)?.[1];
    if (!heading) {
      missing.push(index + 1);
      return;
    }
    const key = fold(heading).replace(/\s+/g, ' ').trim();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  return {
    missing,
    repeated: [...seen].filter(([, count]) => count > 1).map(([heading]) => heading),
  };
}

export interface CraftCheck {
  /** Problemas concretos para la reescritura (en el idioma del equipo: español). */
  issues: string[];
  dialogue: boolean;
  repeated: number;
  morals: number;
  /** Frases de emoción repetidas, palabras de adulto y amigos sin nombre (DECISIONS 329). */
  phrases?: number;
}

/** Los tres controles juntos, con la lista de problemas para la revisión editorial. */
export function storyCraftIssues(input: {
  pages: readonly CraftPage[];
  age: number;
  language: Locale;
  names?: readonly string[];
  /** Estribillo del plan: se repite a propósito. */
  refrain?: string | null;
  /** Historia en formato diario (etiqueta «diario»): cada entrada con su encabezado. */
  diary?: boolean;
  /** El pedido pide un abrazo de la familia (cuento para dormir, de cariño): uno en todo el libro. */
  familyHug?: boolean;
  /** Nombres de otros chicos de la cuenta y lo que el pedido nombra (ver {@link foreignNames}). */
  foreign?: { candidates: readonly string[]; allowed: readonly string[] };
}): CraftCheck {
  const issues: string[] = [];
  const strangers = input.foreign
    ? foreignNames(input.pages, input.foreign.candidates, input.foreign.allowed)
    : [];
  for (const item of strangers) {
    issues.push(
      `«${item.name}» (página ${item.pages.join(', ')}) no es de este pedido: sácalo y, si hace falta alguien, usa un personaje de la historia sin ese nombre.`,
    );
  }
  const share = dialogueShare(input.pages);
  const dialogue = input.age >= DIALOGUE_MIN_AGE && share < DIALOGUE_MIN_SHARE;
  if (dialogue) {
    issues.push(
      `Hay diálogo en ${String(Math.round(share * 100))} % de las páginas: suma diálogo (con raya) para que al menos una de cada tres páginas lo tenga, y que cada personaje hable distinto.`,
    );
  }
  const repeated = repeatedWords(input.pages, input);
  for (const item of repeated) {
    issues.push(
      item.page === null
        ? `La palabra «${item.word}» aparece ${String(item.count)} veces en el libro: cambia algunas por sinónimos o reescribe la frase.`
        : `La palabra «${item.word}» aparece ${String(item.count)} veces en la página ${String(item.page)}: reescribe esa página para no repetirla.`,
    );
  }
  const touch = touchPages(input.pages);
  if (touch.length > 0) {
    issues.push(
      `Contacto físico en la página ${touch.join(', ')} (abrazo, beso, brazos, regazo o cosquillas con alguien que no es de la familia directa): reescribe sin tocarse; el consuelo va con palabras, estar al lado, un objeto compartido o chocar los cinco.`,
    );
  }
  const family = familyTouchPages(input.pages);
  const allowed = input.familyHug ? 1 : 0;
  if (family.length > allowed) {
    issues.push(
      allowed
        ? `Hay abrazos o contacto con la familia en las páginas ${family.join(', ')}: deja uno solo, corto y contado con lo que siente; en las otras van juntos, uno al lado del otro.`
        : `Abrazo o contacto con la familia en la página ${family.join(', ')} que el pedido no pidió: cuéntalo sin tocarse (caminan juntos, se sonríen, se miran); nunca «me abraza».`,
    );
  }
  const refrain = input.refrain?.trim() ?? '';
  const withRefrain = refrainPages(input.pages, refrain);
  const neededRefrain = Math.min(
    REFRAIN_MIN,
    input.pages.filter((page) => page.text.trim()).length,
  );
  if (refrain && withRefrain.length < neededRefrain) {
    issues.push(
      `La frase que se repite «${refrain}» aparece igual solo en ${String(withRefrain.length)} página(s): tiene que estar letra por letra en al menos ${String(neededRefrain)} (al principio, en el medio y al final). Donde se cambió por otra parecida, vuelve a la frase exacta.`,
    );
  }
  const morals = moralPhrases(input.pages, input.language);
  if (morals.length > 0) {
    issues.push(
      `Moraleja explícita (${morals.map((phrase) => `«${phrase}»`).join(', ')}): sácala y muestra la enseñanza con lo que hacen los personajes; el final termina en una imagen o una frase, nunca en una lección.`,
    );
  }
  const phrases = repeatedPhrases(input.pages, input);
  if (phrases.length > 0) {
    issues.push(
      `Frases repetidas en varias páginas (${phrases.map((phrase) => `«${phrase}»`).join(', ')}): cuenta cada emoción con palabras distintas y con lo que hace o nota el cuerpo.`,
    );
  }
  const adult = adultWords(input.pages, input.language);
  if (adult.length > 0) {
    issues.push(
      `Palabras de adulto (${adult.map((word) => `«${word}…»`).join(', ')}): cámbialas por palabras que usa un chico de ${String(input.age)} años.`,
    );
  }
  const unnamed = unnamedFriendPages(input.pages, input.language);
  if (unnamed.length > 0) {
    issues.push(
      `Un amigo o compañero sin nombre vuelve en las páginas ${unnamed.join(', ')}: dale un nombre propio (el del plan si lo tiene) y llámalo siempre así.`,
    );
  }
  const headings = input.diary ? diaryHeadingIssues(input.pages) : { missing: [], repeated: [] };
  if (headings.missing.length > 0) {
    issues.push(
      `Entradas del diario sin encabezado (páginas ${headings.missing.join(', ')}): cada entrada empieza con en qué momento del año está y un título corto con humor, separados por dos puntos (por ejemplo «Semana 6, martes: el ensayo desastre»).`,
    );
  }
  if (headings.repeated.length > 0) {
    issues.push(
      `Encabezados repetidos en el diario (${headings.repeated.map((heading) => `«${heading}»`).join(', ')}): el año avanza, cada entrada es un momento nuevo con su propio encabezado.`,
    );
  }
  return {
    issues,
    dialogue,
    repeated: repeated.length,
    morals: morals.length,
    phrases:
      strangers.length +
      family.length -
      Math.min(family.length, allowed) +
      (refrain && withRefrain.length < neededRefrain ? 1 : 0) +
      phrases.length +
      adult.length +
      unnamed.length +
      headings.missing.length +
      headings.repeated.length,
  };
}
