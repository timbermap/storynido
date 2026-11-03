import { describe, expect, it } from 'vitest';

import { plain, secretMessage, storyWords, wordSearch } from './puzzles';

describe('pasatiempos del kit', () => {
  it('toma del cuento las palabras largas y distintas, con el nombre primero', () => {
    const words = storyWords(
      ['Angélica miró la constelación desde el cohete.', 'La constelación brillaba para Angélica.'],
      'Angélica',
      4,
      14,
    );
    expect(words[0]).toBe('ANGELICA');
    expect(words).toContain('CONSTELACION');
    expect(new Set(words).size).toBe(words.length);
    expect(words.every((word) => /^[A-Z]+$/.test(word))).toBe(true);
  });

  it('coloca todas las palabras y la misma semilla da la misma sopa', () => {
    const words = ['PLANETA', 'COHETE', 'ESTRELLA', 'GALAXIA', 'ANGELICA', 'ASTRONAUTA'];
    const first = wordSearch(words, 12, 5, false);
    expect(first.words.sort()).toEqual([...words].sort());
    expect(first.solution.size).toBeGreaterThan(0);
    expect(wordSearch(words, 12, 5, false).grid).toEqual(first.grid);
  });

  it('el mensaje secreto usa un número distinto por letra y se puede descifrar', () => {
    const secret = secretMessage('FELIZ CUMPLE ANA', 3);
    const table = new Map(secret.key.map((entry) => [entry.number, entry.letter]));
    const decoded = secret.words.map((word) => word.map((number) => table.get(number)).join(''));
    expect(decoded.join(' ')).toBe('FELIZ CUMPLE ANA');
    expect(new Set(secret.key.map((entry) => entry.number)).size).toBe(secret.key.length);
  });

  it('quita tildes y signos', () => {
    expect(plain('¡Año Nuevo!')).toBe('ANONUEVO');
  });
});
