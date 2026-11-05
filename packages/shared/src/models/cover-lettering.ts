/**
 * Portadas con letra a mano (Amatic SC): el nombre grande, cada letra con un leve giro y
 * desplazamiento. El azar sale del nombre (misma semilla → mismo resultado), así la muestra de la
 * web y el libro impreso (PDF) se ven iguales.
 */

/** Hasta cuánto gira (grados) y sube o baja (fracción del alto de la letra) cada letra. */
export const LETTER_JITTER = { maxRotateDeg: 5, maxShift: 0.04 } as const;

export interface LetterJitter {
  char: string;
  /** Grados (entre −5 y 5). */
  rotate: number;
  /** Fracción del alto de la letra (entre −0,04 y 0,04); positivo es hacia abajo. */
  shift: number;
}

/** FNV-1a de 32 bits: un número estable para cada texto. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32: pseudoaleatorio simple y reproducible a partir de una semilla. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Giro y desplazamiento de cada letra del nombre; los espacios quedan derechos. */
export function letterJitter(name: string): LetterJitter[] {
  const next = random(hash(name.trim().toLocaleUpperCase()));
  return Array.from(name).map((char) => {
    const a = next();
    const b = next();
    if (/\s/u.test(char)) return { char, rotate: 0, shift: 0 };
    return {
      char,
      rotate: round((a * 2 - 1) * LETTER_JITTER.maxRotateDeg),
      shift: round((b * 2 - 1) * LETTER_JITTER.maxShift * 100) / 100,
    };
  });
}

/**
 * El título partido alrededor del nombre ("La gran aventura espacial de" + "Tomás"). Sin el nombre
 * en el título, todo va en `before` y `name` queda vacío.
 */
export function splitCoverTitle(
  title: string,
  name: string,
): { before: string; name: string; after: string } {
  const clean = name.trim();
  const at = clean ? title.toLocaleLowerCase().indexOf(clean.toLocaleLowerCase()) : -1;
  if (at < 0) return { before: title.trim(), name: '', after: '' };
  return {
    before: title.slice(0, at).trim(),
    name: title.slice(at, at + clean.length),
    after: title.slice(at + clean.length).trim(),
  };
}
