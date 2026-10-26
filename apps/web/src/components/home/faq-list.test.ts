import { describe, expect, it } from 'vitest';

import { parseFaq } from './faq-list';

describe('parseFaq', () => {
  it('separa preguntas y respuestas por encabezados ###', () => {
    const items = parseFaq(
      'Intro ignorada\n\n### ¿Uno?\n\nRespuesta uno.\n\n### ¿Dos?\nRespuesta **dos**.\n',
    );
    expect(items).toEqual([
      { question: '¿Uno?', answer: 'Respuesta uno.' },
      { question: '¿Dos?', answer: 'Respuesta **dos**.' },
    ]);
  });

  it('descarta preguntas sin respuesta', () => {
    expect(parseFaq('### ¿Sola?\n')).toEqual([]);
  });
});
