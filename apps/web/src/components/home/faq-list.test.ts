import { describe, expect, it } from 'vitest';

import { parseFaq, parseFaqGroups } from './faq-list';

const md = `### ¿Suelta?

Sí.

## Cómo funciona

### ¿Primera?

Uno.

## Fotos

### ¿Segunda?

Dos.`;

describe('preguntas frecuentes', () => {
  it('agrupa por "## " y deja las sueltas en un grupo sin título', () => {
    expect(parseFaqGroups(md)).toEqual([
      { title: null, items: [{ question: '¿Suelta?', answer: 'Sí.' }] },
      { title: 'Cómo funciona', items: [{ question: '¿Primera?', answer: 'Uno.' }] },
      { title: 'Fotos', items: [{ question: '¿Segunda?', answer: 'Dos.' }] },
    ]);
  });

  it('la lista plana no arrastra los títulos de grupo a las respuestas', () => {
    expect(parseFaq(md).map((item) => item.answer)).toEqual(['Sí.', 'Uno.', 'Dos.']);
  });
});
