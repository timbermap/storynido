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

export interface CraftCheck {
  /** Problemas concretos para la reescritura (en el idioma del equipo: español). */
  issues: string[];
  dialogue: boolean;
  repeated: number;
  morals: number;
}

/** Los tres controles juntos, con la lista de problemas para la revisión editorial. */
export function storyCraftIssues(input: {
  pages: readonly CraftPage[];
  age: number;
  language: Locale;
  names?: readonly string[];
}): CraftCheck {
  const issues: string[] = [];
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
  const morals = moralPhrases(input.pages, input.language);
  if (morals.length > 0) {
    issues.push(
      `Moraleja explícita (${morals.map((phrase) => `«${phrase}»`).join(', ')}): sácala y muestra la enseñanza con lo que hacen los personajes; el final termina en una imagen o una frase, nunca en una lección.`,
    );
  }
  return { issues, dialogue, repeated: repeated.length, morals: morals.length };
}
