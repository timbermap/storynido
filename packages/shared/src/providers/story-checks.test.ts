import { describe, expect, it } from 'vitest';

import { dialogueShare, moralPhrases, repeatedWords, storyCraftIssues } from './story-checks';

const pages = (...texts: string[]) => texts.map((text) => ({ text }));

describe('controles del oficio del texto', () => {
  it('diálogo: raya, comillas o guion; las páginas sin texto no cuentan', () => {
    expect(
      dialogueShare(pages('—Vamos —dijo Sofi.', 'El mar brillaba.', '«Ya llego», pensó.', '')),
    ).toBeCloseTo(2 / 3);
    expect(dialogueShare(pages('- Hola, Tomi.', 'Nada.'))).toBe(0.5);
    expect(dialogueShare(pages(''))).toBe(0);
  });

  it('desde 6 años pide diálogo en al menos una de cada tres páginas', () => {
    const quiet = pages('Sofi corre.', 'Sofi salta.', 'Sofi nada.', 'Sofi ríe.');
    expect(storyCraftIssues({ pages: quiet, age: 7, language: 'es' }).dialogue).toBe(true);
    expect(storyCraftIssues({ pages: quiet, age: 4, language: 'es' }).dialogue).toBe(false);
  });

  it('palabras repetidas: más de 2 en una página o más de 4 en el libro, sin vacías ni nombres', () => {
    const found = repeatedWords(
      pages(
        'La cometa sube, la cometa baja, la cometa gira. Sofi mira a Sofi y a Sofi.',
        'Una ola grande.',
        'Otra ola.',
        'La ola vuelve.',
        'Una ola más.',
        'Y otra ola, para todos, para todas, para cada uno.',
      ),
      { language: 'es', names: ['Sofi'] },
    );
    expect(found).toContainEqual({ word: 'cometa', count: 3, page: 1 });
    expect(found).toContainEqual({ word: 'ola', count: 5, page: null });
    expect(found.map((item) => item.word)).not.toContain('sofi');
    expect(found.map((item) => item.word)).not.toContain('para');
  });

  it('en libros largos el tope del libro crece con las páginas', () => {
    const book = pages(
      ...Array.from({ length: 24 }, (_, index) => (index < 6 ? 'el faro' : 'mar')),
    );
    expect(repeatedWords(book, { language: 'es' }).map((item) => item.word)).not.toContain('faro');
  });

  it('moralejas explícitas, sin importar tildes ni mayúsculas', () => {
    expect(moralPhrases(pages('Y así Sofi APRENDIÓ QUE nunca hay que rendirse.'), 'es')).toEqual([
      'aprendio que',
    ]);
    expect(moralPhrases(pages('The lesson was clear.'), 'en')).toEqual(['the lesson']);
    expect(moralPhrases(pages('El viento se calmó.'), 'es')).toEqual([]);
  });

  it('arma la lista concreta de problemas para la reescritura', () => {
    const check = storyCraftIssues({
      pages: pages('La perseverancia es el verdadero valor.', 'Fin.'),
      age: 8,
      language: 'es',
    });
    expect(check.morals).toBe(2);
    expect(check.issues.join('\n')).toContain('«perseverancia»');
    expect(check.issues.join('\n')).toContain('diálogo');
  });
});
