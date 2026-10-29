import { describe, expect, it } from 'vitest';

import { kitPieceDocument, type KitBook } from './kit';

const book = (occasion: KitBook['occasion']): KitBook => ({
  language: 'es',
  childName: 'Sofi',
  title: 'Un día especial',
  occasion,
  turningAge: occasion === 'birthday' ? 6 : null,
  eventDate: '2026-12-05',
  invitation: { time: '17 h', place: 'Casa de la abuela' },
  cover: 'data:image/png;base64,AAAA',
  paper: 'a4',
});

describe('kit por ocasión', () => {
  it('el cumpleaños dice la edad que cumple', () => {
    expect(kitPieceDocument(book('birthday'), 'invitation', 20).html).toContain('¡Sofi cumple 6!');
  });

  it('el bautismo no habla de cumpleaños', () => {
    const html = [
      kitPieceDocument(book('baptism'), 'invitation', 20).html,
      kitPieceDocument(book('baptism'), 'thank_you', 20).html,
      kitPieceDocument(book('baptism'), 'activities', 20).html,
    ].join('');
    expect(html).toContain('¡Te invito a mi bautismo!');
    expect(html).toContain('para el bautismo de Sofi');
    expect(html.toLowerCase()).not.toContain('cumple');
    expect(html).not.toContain('torta de cumpleaños');
  });

  it('el egreso tiene sus propias actividades', () => {
    expect(kitPieceDocument(book('graduation'), 'activities', 20).html).toContain(
      'Ayuda a Sofi a llegar a su diploma',
    );
  });
});
