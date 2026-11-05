import { random } from './maze';

/**
 * Pasatiempos del kit (sin IA): sopa de letras con palabras del cuento, mensaje secreto y unir
 * puntos. Todo es determinístico (misma semilla, misma hoja) para que una hoja se pueda regenerar.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const STOPWORDS = new Set(
  (
    'PARA PERO COMO CUANDO DONDE AQUEL AQUELLA AQUELLOS ESTA ESTE ESTOS ESTAS ESTABA ESTABAN TODO TODOS TODAS TENIA ' +
    'TENIAN SOBRE ENTRE HASTA DESDE TAMBIEN PORQUE AHORA ENTONCES DESPUES ANTES SIEMPRE NUNCA CADA MUCHO MUCHA MUCHOS ' +
    'MUCHAS ALGO ALGUN ALGUNA PUEDE PUEDEN HABIA SEGUN SIDO FUERON ELLOS ELLAS NOSOTROS QUIERO QUIERES SOLO SOLA ' +
    'OTRO OTRA OTROS OTRAS MISMO MISMA PRIMER PRIMERA ULTIMO ULTIMA GRAN GRANDE GRANDES PEQUEÑO PEQUEÑA NUEVO NUEVA ' +
    'MEJOR VEZ VECES DIA RATO FORMA MANERA COSA COSAS LADO ' +
    'WITH THAT THIS THEY THEIR THERE WHEN WHERE WHICH WOULD COULD ABOUT AFTER BEFORE EVERY FROM HAVE HAD WERE WHAT ' +
    'OTHER SAME FIRST LAST LITTLE GREAT BIG NEW BEST TIME TIMES WAY THING THINGS SIDE ' +
    'COM PARA MAIS ESSE ESSA ESTE ESTA TODOS TODAS QUANDO ONDE ENTAO DEPOIS ANTES SEMPRE NUNCA CADA MUITO MUITA ' +
    'OUTRO OUTRA MESMO MESMA PRIMEIRO PRIMEIRA ULTIMO GRANDE NOVO NOVA MELHOR VEZ COISA'
  ).split(' '),
);

/** Determinantes: la palabra que sigue suele ser un sustantivo (objeto, lugar, pasatiempo). */
const DETERMINERS = new Set(
  (
    'el la los las un una unos unas su sus mi mis tu tus del al ' +
    'the a an his her their my your our ' +
    'o os as um uma uns umas seu sua seus suas do da dos das no na nos nas ao meu minha'
  ).split(' '),
);

/** Terminaciones de adverbios y verbos conjugados: no son sustantivos. */
const NOT_NOUN = /(MENTE|ANDO|IENDO|ABAN|ARON|IERON|ABA|IAN|ING|ED|LY)$/;

/**
 * Mayúsculas sin tildes ni signos, como se escribe una sopa de letras. La Ñ y la Ç son letras
 * propias: se conservan (antes ACOMPAÑARÍAN salía ACOMPANARIAN).
 */
export function plain(word: string): string {
  return Array.from(word.toUpperCase())
    .map((char) =>
      char === 'Ñ' || char === 'Ç'
        ? char
        : char
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z]/g, ''),
    )
    .join('');
}

/**
 * Palabras del cuento para la sopa de letras: sustantivos (lo que sigue a «el», «la», «un»... y los
 * nombres propios en mitad de una frase), los que más se repiten primero; más el nombre del
 * protagonista, si entra. Antes se elegían por largo y salían COMPLETAMENTE o PROFUNDAMENTE.
 */
export function storyWords(texts: readonly string[], name: string, count: number, max: number) {
  const own = plain(name);
  const seen = new Map<string, { nouns: number; total: number }>();
  for (const text of texts) {
    const tokens = text.split(/(\s+)/u);
    let previous = '';
    let sentenceStart = true;
    for (const token of tokens) {
      if (/^\s+$/u.test(token)) continue;
      const raw = token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      const word = plain(raw);
      const proper = !sentenceStart && /^\p{Lu}/u.test(raw);
      const afterDeterminer = DETERMINERS.has(previous);
      if (word.length >= 4 && word.length <= max && !STOPWORDS.has(word) && word !== own) {
        const entry = seen.get(word) ?? { nouns: 0, total: 0 };
        entry.total += 1;
        if ((afterDeterminer || proper) && !NOT_NOUN.test(word)) entry.nouns += 1;
        seen.set(word, entry);
      }
      previous = raw.toLowerCase();
      sentenceStart = /[.!?¡¿:;«»"—]$/u.test(token) || raw === '';
    }
  }
  const ranked = [...seen.entries()]
    .filter(([, entry]) => entry.nouns > 0)
    // Los sustantivos más repetidos primero; a igual cantidad, los más largos.
    .sort(
      (a, b) =>
        b[1].nouns + b[1].total - (a[1].nouns + a[1].total) ||
        b[0].length - a[0].length ||
        a[0].localeCompare(b[0]),
    )
    .map(([word]) => word);
  const picked = own.length >= 3 && own.length <= max ? [own] : [];
  for (const word of ranked) {
    if (picked.length >= count) break;
    // Una palabra dentro de otra se encuentra sola: se evita.
    if (!picked.some((other) => other.includes(word) || word.includes(other))) picked.push(word);
  }
  return picked.slice(0, count);
}

export interface WordSearch {
  size: number;
  grid: string[][];
  words: string[];
  /** Celdas ocupadas por las palabras, "fila,columna". */
  solution: Set<string>;
}

export function wordSearch(
  words: readonly string[],
  size: number,
  seed: number,
  hard: boolean,
): WordSearch {
  const next = random(seed);
  const grid: (string | null)[][] = Array.from({ length: size }, () =>
    Array<string | null>(size).fill(null),
  );
  const directions: [number, number][] = hard
    ? [
        [0, 1],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, 0],
      ]
    : [
        [0, 1],
        [1, 0],
        [1, 1],
      ];
  const solution = new Set<string>();
  const placed: string[] = [];
  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    let done = false;
    for (let attempt = 0; attempt < 300 && !done; attempt += 1) {
      const [dr, dc] = directions[Math.floor(next() * directions.length)] ?? [0, 1];
      const row = Math.floor(next() * size);
      const col = Math.floor(next() * size);
      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endCol < 0 || endRow >= size || endCol >= size) continue;
      const fits = Array.from(word).every((letter, index) => {
        const cell = grid[row + dr * index]?.[col + dc * index];
        return cell === null || cell === letter;
      });
      if (!fits) continue;
      Array.from(word).forEach((letter, index) => {
        const r = row + dr * index;
        const c = col + dc * index;
        const line = grid[r];
        if (line) line[c] = letter;
        solution.add(`${String(r)},${String(c)}`);
      });
      done = true;
    }
    if (done) placed.push(word);
  }
  // Si alguna palabra lleva Ñ o Ç, el relleno también las usa (si no, se notarían a simple vista).
  const extra = ['Ñ', 'Ç'].filter((letter) => placed.some((word) => word.includes(letter)));
  const letters = [...Array.from(ALPHABET), ...extra];
  const filled = grid.map((line) =>
    line.map((cell) => cell ?? letters[Math.floor(next() * letters.length)] ?? 'A'),
  );
  return { size, grid: filled, words: placed, solution };
}

export function wordSearchSvg(puzzle: WordSearch, showSolution: boolean): string {
  const cell = 10;
  const size = puzzle.size * cell;
  const marks = showSolution
    ? [...puzzle.solution]
        .map((key) => {
          const [row = 0, col = 0] = key.split(',').map(Number);
          return `<rect x="${String(col * cell + 0.5)}" y="${String(row * cell + 0.5)}" width="${String(cell - 1)}" height="${String(cell - 1)}" rx="2.5" fill="#d6ab68" opacity="0.55"/>`;
        })
        .join('')
    : '';
  const letters = puzzle.grid
    .map((line, row) =>
      line
        .map(
          (letter, col) =>
            `<text x="${String(col * cell + cell / 2)}" y="${String(row * cell + cell / 2 + 3.4)}" text-anchor="middle" font-size="7.6" font-family="'Nunito Sans', sans-serif" font-weight="700" fill="#342a40">${letter}</text>`,
        )
        .join(''),
    )
    .join('');
  return `<svg viewBox="-1 -1 ${String(size + 2)} ${String(size + 2)}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${String(size)}" height="${String(size)}" rx="3" fill="#fffaf3" stroke="#342a40" stroke-width="0.8"/>${marks}${letters}</svg>`;
}

/** Mensaje secreto: cada letra es un número (la tabla va en la hoja). La clave se baraja con la semilla. */
export function secretMessage(message: string, seed: number) {
  const next = random(seed);
  // La Ñ (o la Ç) del nombre es una letra más de la tabla.
  const alphabet = [
    ...Array.from(ALPHABET),
    ...['Ñ', 'Ç'].filter((letter) => plain(message).includes(letter)),
  ];
  const numbers = Array.from({ length: alphabet.length }, (_, index) => index + 1);
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    const held = numbers[index] ?? 0;
    numbers[index] = numbers[swap] ?? 0;
    numbers[swap] = held;
  }
  const code = new Map(alphabet.map((letter, index) => [letter, numbers[index] ?? 0]));
  const words = message
    .split(' ')
    .map((word) => Array.from(plain(word)).map((letter) => code.get(letter) ?? 0));
  // La tabla, en orden alfabético, solo con las letras que el mensaje usa y unas pocas más.
  const used = new Set(Array.from(plain(message)));
  const key = alphabet.filter((letter) => used.has(letter) || next() < 0.35);
  return { words, key: key.map((letter) => ({ letter, number: code.get(letter) ?? 0 })) };
}

/** Unir puntos: una estrella de cinco puntas con 10 vértices numerados. */
export function dotsSvg(): string {
  const points: [number, number][] = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? 46 : 20;
    points.push([50 + radius * Math.cos(angle), 52 + radius * Math.sin(angle)]);
  }
  const dots = points
    .map(
      ([x, y], index) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="#342a40"/><text x="${(x + (x < 50 ? -4.2 : 2.4)).toFixed(1)}" y="${(y + (y < 52 ? -2.2 : 4.4)).toFixed(1)}" font-size="5.2" font-family="'Nunito Sans', sans-serif" font-weight="700" fill="#79518c">${String(index + 1)}</text>`,
    )
    .join('');
  return `<svg viewBox="0 0 100 104" xmlns="http://www.w3.org/2000/svg">${dots}</svg>`;
}

/**
 * Palabras revueltas (desde 9 años): cada palabra con sus letras mezcladas, nunca igual a la
 * original. Determinístico con la semilla.
 */
export function scrambleWords(words: readonly string[], seed: number) {
  const next = random(seed);
  return words.map((word) => {
    const letters = Array.from(word);
    let mixed = word;
    for (let attempt = 0; attempt < 10 && (mixed === word || letters.length < 2); attempt += 1) {
      for (let index = letters.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(next() * (index + 1));
        const held = letters[index] ?? '';
        letters[index] = letters[swap] ?? '';
        letters[swap] = held;
      }
      mixed = letters.join('');
    }
    // Si la mezcla no la cambió (pocas letras distintas), se rota una letra.
    if (mixed === word) mixed = `${word.slice(1)}${word.charAt(0)}`;
    return { word, mixed };
  });
}
