import { describe, expect, it } from 'vitest';

import {
  familyTouchPages,
  refrainPages,
  adultWords,
  diaryHeadingIssues,
  dialogueShare,
  moralPhrases,
  repeatedPhrases,
  repeatedWords,
  storyCraftIssues,
  touchPages,
  unnamedFriendPages,
} from './story-checks';

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

describe('contacto físico', () => {
  it('marca un abrazo de un amigo y deja pasar el de la familia', () => {
    expect(
      touchPages([
        { text: 'Un abrazo apretado de Santi terminó de enfriar el volcán.' },
        { text: 'Mamá le dio un abrazo corto y apagó la luz.' },
        { text: 'Luli giró en el aire.' },
      ]),
    ).toEqual([1]);
  });
});

describe('revisión de «El diario de Luli» (DECISIONS 329)', () => {
  it('marca la mano de una amiga en el brazo, no la mano levantada en clase', () => {
    expect(
      touchPages([
        { text: 'Cata me puso la mano en el hombro y sonrió.' },
        { text: 'Levanté la mano para contestar.' },
        { text: 'Mateo me tomó del brazo para que no me cayera.' },
      ]),
    ).toEqual([1, 3]);
  });

  it('encuentra la misma frase de emoción en varias páginas y respeta el estribillo', () => {
    const book = pages(
      'Sentí un alivio enorme cuando terminó.',
      'Otra vez ese alivio enorme en el pecho.',
      '—¡Corazón valiente! —dijo Luli.',
      '—¡Corazón valiente! —repitió Luli.',
    );
    expect(repeatedPhrases(book, { language: 'es', refrain: '¡Corazón valiente!' })).toEqual([
      'alivio enorme',
    ]);
  });

  it('marca palabras de adulto', () => {
    expect(adultWords(pages('Mi vulnerabilidad era total.'), 'es')).toEqual(['vulnerabilidad']);
    expect(adultWords(pages('Me temblaban las rodillas.'), 'es')).toEqual([]);
  });

  it('marca un amigo que vuelve sin nombre, no uno con nombre', () => {
    expect(
      unnamedFriendPages(
        pages('Mi compañero me guiñó un ojo.', 'Hoy mi compañero llegó tarde.'),
        'es',
      ),
    ).toEqual([1, 2]);
    expect(
      unnamedFriendPages(pages('Mi amigo Tomás trajo la guitarra.', 'Mi amiga Cata cantó.'), 'es'),
    ).toEqual([]);
    const check = storyCraftIssues({
      pages: pages('Mi compañero rió.', 'Mi compañero cantó.'),
      age: 11,
      language: 'es',
    });
    expect(check.issues.join('\n')).toContain('sin nombre');
  });
});

describe('encabezados del diario (DECISIONS 330)', () => {
  it('marca entradas sin encabezado y encabezados repetidos', () => {
    const result = diaryHeadingIssues(
      pages(
        'Primer día de clases: el peor comienzo. Llegué tarde.',
        'Hoy no pasó nada.',
        'Semana 6, martes: el ensayo desastre. Mateo se olvidó la guitarra.',
        'Semana 6, martes: otra vez. Ensayamos de nuevo.',
      ),
    );
    expect(result.missing).toEqual([2]);
    expect(result.repeated).toEqual(['semana 6, martes']);
  });

  it('solo se pide en los diarios', () => {
    const book = pages('Hoy no pasó nada.', 'Mañana tampoco.');
    expect(storyCraftIssues({ pages: book, age: 11, language: 'es' }).issues.join()).not.toContain(
      'encabezado',
    );
    expect(
      storyCraftIssues({ pages: book, age: 11, language: 'es', diary: true }).issues.join(),
    ).toContain('sin encabezado');
  });
});

describe('libro de Angélica, «El sonido escondido» (25 nov 2026)', () => {
  const pages = [
    { text: 'Entro al bosque con mi papá. Escucho, escucho, ¿quién será?' },
    { text: 'Miro adentro de un tronco. Oigo, oigo, ¿quién será?' },
    { text: '¡Ahí está! Presto oído, ¿quién será?' },
    { text: 'Papá me abraza fuerte. Volvemos silbando a casa.' },
  ];

  it('el estribillo cambiado por otro parecido no cuenta', () => {
    expect(refrainPages(pages, 'Oigo, oigo, ¿quién será?')).toEqual([2]);
    const check = storyCraftIssues({
      pages,
      age: 3,
      language: 'es',
      refrain: 'Oigo, oigo, ¿quién será?',
    });
    expect(check.issues.some((issue) => issue.includes('letra por letra'))).toBe(true);
  });

  it('el estribillo igual en 3 páginas no da aviso (sin importar mayúsculas ni signos)', () => {
    const fixed = pages.map((page, index) =>
      index < 3 ? { text: `${page.text} OIGO, OIGO, ¿QUIÉN SERÁ?` } : page,
    );
    expect(refrainPages(fixed, 'Oigo, oigo, ¿quién será?')).toEqual([1, 2, 3]);
  });

  it('un abrazo de la familia que el pedido no pidió es un problema', () => {
    expect(familyTouchPages(pages)).toEqual([4]);
    const check = storyCraftIssues({ pages, age: 3, language: 'es' });
    expect(check.issues.some((issue) => issue.includes('que el pedido no pidió'))).toBe(true);
  });

  it('con el abrazo pedido, uno solo está bien', () => {
    const check = storyCraftIssues({ pages, age: 3, language: 'es', familyHug: true });
    expect(check.issues.some((issue) => issue.includes('abraz'))).toBe(false);
  });
});
