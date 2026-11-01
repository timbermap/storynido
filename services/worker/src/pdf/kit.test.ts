import { describe, expect, it } from 'vitest';

import {
  CARD_PRINT_SIZE,
  INVITATION_IMAGE_SIZE,
  invitationImageHtml,
  kitCardPrintDocument,
  kitPieceDocument,
  type KitBook,
} from './kit';

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

describe('firma de la invitación', () => {
  it('lleva «Hecho con StoryNido» por defecto y se puede quitar', () => {
    expect(kitPieceDocument(book('birthday'), 'invitation', 20).html).toContain(
      'Hecho con StoryNido',
    );
    expect(
      kitPieceDocument({ ...book('birthday'), signature: false }, 'invitation', 20).html,
    ).not.toContain('Hecho con StoryNido');
  });
});

describe('invitación para WhatsApp', () => {
  it('es una imagen 4:5 de 1080×1350 con el nombre, los datos y la firma', () => {
    expect(INVITATION_IMAGE_SIZE).toEqual({ width: 1080, height: 1350 });
    const html = invitationImageHtml(book('birthday'));
    expect(html).toContain('¡Sofi cumple 6!');
    expect(html).toContain('Casa de la abuela');
    expect(html).toContain('Hecho con StoryNido');
    expect(invitationImageHtml({ ...book('birthday'), signature: false })).not.toContain(
      'Hecho con StoryNido',
    );
  });

  it('escapa el lugar escrito por el cliente', () => {
    const html = invitationImageHtml({
      ...book('birthday'),
      invitation: { time: null, place: '<script>x</script>' },
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('etiquetas por invitado', () => {
  it('sin lista, una hoja con la etiqueta genérica', () => {
    const doc = kitPieceDocument(book('birthday'), 'favor_tags', 20);
    expect(doc.pages).toBe(1);
    expect(doc.html).toContain('¡Gracias por venir!');
    expect(doc.html).not.toContain('Para ');
  });

  it('con lista, una etiqueta por invitado (9 por hoja) y el nombre escapado', () => {
    const guests = Array.from({ length: 11 }, (_, index) => `Invitado ${String(index + 1)}`);
    const doc = kitPieceDocument(
      { ...book('birthday'), guests: [...guests, '<b>Lola</b>'] },
      'favor_tags',
      20,
    );
    expect(doc.pages).toBe(2);
    expect(doc.html).toContain('Para Invitado 1');
    expect(doc.html).toContain('Para Invitado 11');
    expect(doc.html).toContain('Para &lt;b&gt;Lola&lt;/b&gt;');
    expect(doc.html).not.toContain('<b>Lola</b>');
    expect(doc.html).not.toContain('¡Gracias por venir!');
  });
});

describe('tarjeta para imprimir', () => {
  it('es un PDF de dos páginas (frente y dorso) del tamaño de la tarjeta con sangrado', () => {
    const doc = kitCardPrintDocument(book('birthday'), 'invitation');
    expect(doc.pages).toBe(2);
    expect(doc.size).toEqual(CARD_PRINT_SIZE);
    // 127×178 mm más 3 mm de sangrado por lado.
    expect(doc.size).toEqual({ width: 133, height: 184 });
    expect(doc.html).toContain('¡Sofi cumple 6!');
    expect(doc.html).toContain('Casa de la abuela');
  });

  it('sin marcas de corte ni leyenda de licencia: la imprenta corta sola', () => {
    const html = kitCardPrintDocument(book('birthday'), 'thank_you').html;
    expect(html).not.toContain('class="marks"');
    expect(html).not.toContain('Licencia StoryNido');
  });
});
