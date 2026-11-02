import { describe, expect, it } from 'vitest';

import { pickHomeState, type HomeBook, type HomeOrder } from './home-state';

const book = (over: Partial<HomeBook> = {}): HomeBook => ({
  id: 'b1',
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

const order = (over: Partial<HomeOrder> = {}): HomeOrder => ({
  id: 'o1',
  bookId: 'b1',
  channel: 'families',
  childName: 'Toto',
  childId: 'c1',
  title: null,
  coverUrl: null,
  characterUrl: null,
  status: 'delivered',
  print: true,
  createdAt: 1,
  etaFrom: null,
  etaTo: null,
  ...over,
});

describe('pickHomeState', () => {
  it('sin nada, es una persona nueva', () => {
    expect(pickHomeState([], [])).toEqual({ kind: 'new' });
  });

  it('un borrador incompleto, uno que se está dibujando, un personaje por aprobar y una vista previa lista', () => {
    expect(pickHomeState([book({ stage: 'draft' })], []).kind).toBe('draft');
    expect(pickHomeState([book({ stage: 'generating' })], []).kind).toBe('generating');
    expect(pickHomeState([book({ stage: 'character' })], []).kind).toBe('character');
    expect(pickHomeState([book({ stage: 'preview' })], []).kind).toBe('preview');
  });

  it('con varios cuentos manda el más cercano a la compra, y a igual cercanía el más reciente', () => {
    const state = pickHomeState(
      [
        book({ id: 'a', stage: 'draft', updatedAt: 9 }),
        book({ id: 'b', stage: 'preview', updatedAt: 1 }),
        book({ id: 'c', stage: 'preview', updatedAt: 5 }),
      ],
      [],
    );
    expect(state).toMatchObject({ kind: 'preview', book: { id: 'c' } });
  });

  it('una muestra sin comprar le gana a un pedido en curso', () => {
    const state = pickHomeState([book({ stage: 'preview' })], [order({ status: 'in_production' })]);
    expect(state.kind).toBe('preview');
  });

  it('pedido impreso en curso: en camino cuando ya salió de imprenta, si no, en preparación', () => {
    expect(pickHomeState([], [order({ status: 'shipped' })])).toMatchObject({
      kind: 'order',
      shipped: true,
    });
    expect(pickHomeState([], [order({ status: 'paid' })])).toMatchObject({
      kind: 'order',
      shipped: false,
    });
  });

  it('un digital listo ya no está en curso: es una compra hecha', () => {
    expect(pickHomeState([], [order({ status: 'ready', print: false })]).kind).toBe('bought');
  });

  it('entregado: ya compró', () => {
    expect(pickHomeState([], [order({ status: 'delivered' })])).toMatchObject({
      kind: 'bought',
      order: { childName: 'Toto' },
    });
  });

  it('un pedido cancelado o reembolsado no cuenta', () => {
    expect(pickHomeState([], [order({ status: 'cancelled' })])).toEqual({ kind: 'new' });
    expect(pickHomeState([], [order({ status: 'refunded' })])).toEqual({ kind: 'new' });
  });

  it('solo proyectos profesionales: estado propio, sin nombre de hijo', () => {
    const state = pickHomeState([book({ channel: 'professionals', stage: 'preview' })], []);
    expect(state.kind).toBe('pro');
  });

  it('un cuento de familia y uno profesional: manda el de la familia', () => {
    const state = pickHomeState(
      [
        book({ id: 'p', channel: 'professionals', stage: 'preview' }),
        book({ id: 'f', stage: 'draft' }),
      ],
      [],
    );
    expect(state).toMatchObject({ kind: 'draft', book: { id: 'f' } });
  });
});
