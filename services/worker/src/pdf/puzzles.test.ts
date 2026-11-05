import { describe, expect, it } from 'vitest';

import { plain, scrambleWords, secretMessage, storyWords, wordSearch } from './puzzles';

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

  it('quita tildes y signos, pero conserva la Ñ y la Ç', () => {
    expect(plain('¡Año Nuevo!')).toBe('AÑONUEVO');
    expect(plain('acompañarían')).toBe('ACOMPAÑARIAN');
    expect(plain('balão')).toBe('BALAO');
    expect(plain('coração')).toBe('CORAÇAO');
  });

  it('elige sustantivos del cuento, no adverbios ni verbos largos', () => {
    const words = storyWords(
      [
        'Sofi tomó la raqueta y corrió completamente feliz hacia la cancha.',
        'Profundamente concentrada, golpeó la pelota con la raqueta. Los amigos la acompañarían al faro.',
        'Desde el faro, Sofi vio la cancha y la montaña.',
      ],
      'Sofi',
      6,
      14,
    );
    expect(words[0]).toBe('SOFI');
    expect(words).toContain('RAQUETA');
    expect(words).toContain('CANCHA');
    expect(words).toContain('FARO');
    expect(words).not.toContain('COMPLETAMENTE');
    expect(words).not.toContain('PROFUNDAMENTE');
    expect(words).not.toContain('ACOMPAÑARIAN');
  });

  it('la Ñ del nombre entra en la sopa y en el mensaje secreto', () => {
    const puzzle = wordSearch(['BEGOÑA', 'MONTAÑA'], 12, 7, false);
    expect(puzzle.words).toEqual(['MONTAÑA', 'BEGOÑA']);
    const secret = secretMessage('FELIZ CUMPLE BEGOÑA', 2);
    const table = new Map(secret.key.map((entry) => [entry.number, entry.letter]));
    expect(secret.words.map((word) => word.map((n) => table.get(n)).join('')).join(' ')).toBe(
      'FELIZ CUMPLE BEGOÑA',
    );
  });

  it('las palabras revueltas nunca quedan iguales a la original', () => {
    for (const { word, mixed } of scrambleWords(['FARO', 'CANCHA', 'OSO', 'ANA'], 9)) {
      expect(mixed).not.toBe(word);
      expect(Array.from(mixed).sort().join('')).toBe(Array.from(word).sort().join(''));
    }
  });
});
