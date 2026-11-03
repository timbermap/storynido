import { describe, expect, it } from 'vitest';

import type { HomeBook } from './home-state';
import {
  ideasFor,
  isCardsOrder,
  linesUsed,
  orderShelf,
  pickNextUp,
  type LibraryOrder,
} from './library';

const book = (over: Partial<HomeBook>): HomeBook => ({
  id: 'b',
  channel: 'families',
  childName: 'Toto',
  title: null,
  coverUrl: null,
  storyId: null,
  characterUrl: null,
  totalPages: null,
  stage: 'draft',
  updatedAt: 1,
  ...over,
});

const order = (over: Partial<LibraryOrder>): LibraryOrder => ({
  id: 'o',
  bookId: 'b',
  channel: 'families',
  childName: 'Toto',
  childId: null,
  storyId: null,
  title: null,
  coverUrl: null,
  characterUrl: null,
  status: 'generating',
  print: true,
  createdAt: 1,
  etaFrom: null,
  etaTo: null,
  items: [{ format: 'hardcover', quantity: 1 }],
  ...over,
});

describe('orderShelf', () => {
  it('un impreso en camino está en curso y uno entregado, terminado', () => {
    expect(orderShelf(order({ status: 'shipped' }))).toBe('inProgress');
    expect(orderShelf(order({ status: 'delivered' }))).toBe('done');
  });

  it('un digital listo está terminado', () => {
    const digital = { items: [{ format: 'digital' as const, quantity: 1 }], print: false };
    expect(orderShelf(order({ ...digital, status: 'ready' }))).toBe('done');
    expect(orderShelf(order({ ...digital, status: 'generating' }))).toBe('inProgress');
  });

  it('cancelados y reembolsados no van en ninguna solapa', () => {
    expect(orderShelf(order({ status: 'cancelled' }))).toBeNull();
    expect(orderShelf(order({ status: 'refunded' }))).toBeNull();
  });
});

describe('pickNextUp', () => {
  it('la muestra lista gana al personaje por aprobar, a lo que se dibuja y al pedido', () => {
    const next = pickNextUp(
      [
        book({ id: 'g', stage: 'generating', updatedAt: 9 }),
        book({ id: 'c', stage: 'character', updatedAt: 8 }),
        book({ id: 'p', stage: 'preview', updatedAt: 1 }),
      ],
      [order({ status: 'shipped' })],
    );
    expect(next).toMatchObject({ kind: 'preview', book: { id: 'p' } });
  });

  it('un borrador a medias no va en «Lo próximo»: gana el pedido en curso', () => {
    const next = pickNextUp([book({ stage: 'draft' })], [order({ status: 'shipped' })]);
    expect(next).toMatchObject({ kind: 'order', shipped: true });
  });

  it('sin nada que pida una acción no hay tarjeta', () => {
    expect(pickNextUp([book({ stage: 'draft' })], [order({ status: 'delivered' })])).toBeNull();
  });
});

describe('linesUsed', () => {
  it('cuenta borradores y pedidos vivos, sin los cancelados', () => {
    expect(
      linesUsed(
        [book({ channel: 'professionals' })],
        [order({ channel: 'events', status: 'cancelled' }), order({ channel: 'families' })],
      ),
    ).toEqual(['families', 'professionals']);
  });
});

describe('isCardsOrder', () => {
  it('solo cuando todos los ítems son tarjetas', () => {
    expect(isCardsOrder(order({ items: [{ format: 'card', quantity: 10 }] }))).toBe(true);
    expect(isCardsOrder(order({}))).toBe(false);
  });
});

describe('ideasFor', () => {
  it('con gustos: otra aventura, el cumpleaños y un momento', () => {
    expect(ideasFor({ likes: ['', 'dinosaurios'] }, { hasKit: false })).toEqual([
      { kind: 'likes', like: 'dinosaurios' },
      { kind: 'birthday' },
      { kind: 'moment' },
    ]);
  });

  it('sin gustos ni kit pendiente solo sugiere lo que se sabe', () => {
    expect(ideasFor({ likes: [] }, { hasKit: true })).toEqual([{ kind: 'moment' }]);
  });
});
