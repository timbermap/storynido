import { describe, expect, it } from 'vitest';

import {
  buildHomeRows,
  HOME_ROWS,
  ordersWithCover,
  parseRemembered,
  pickHomeLine,
  type HomeBook,
  type HomeOrder,
  type HomeSignals,
} from './home-state';

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
  storyId: null,
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

const none: HomeSignals = { proProfile: false, remembered: null };
const pick = (books: HomeBook[], orders: HomeOrder[] = [], signals: Partial<HomeSignals> = {}) =>
  pickHomeLine(books, orders, { ...none, ...signals });

describe('pickHomeLine · regla 1: la muestra más cercana a la compra, de cualquier línea', () => {
  it('cada etapa queda como «Lo próximo»', () => {
    for (const stage of ['draft', 'generating', 'character', 'preview'] as const) {
      expect(pick([book({ stage })])).toMatchObject({
        line: 'families',
        reason: 'book',
        pro: false,
        next: { kind: stage },
      });
    }
  });

  it('vista previa > personaje > dibujando > borrador, y a igual etapa la más reciente', () => {
    const view = pick([
      book({ id: 'a', stage: 'draft', updatedAt: 9 }),
      book({ id: 'b', stage: 'character', updatedAt: 8 }),
      book({ id: 'c', stage: 'preview', updatedAt: 1 }),
      book({ id: 'd', stage: 'preview', updatedAt: 5 }),
    ]);
    expect(view.next).toMatchObject({ kind: 'preview', book: { id: 'd' } });
  });

  it('un kit de Celebraciones decide la línea', () => {
    const view = pick([book({ channel: 'events', stage: 'character' })]);
    expect(view).toMatchObject({ line: 'events', reason: 'book', next: { kind: 'character' } });
  });

  it('gana el de cualquier línea que esté más cerca: el kit listo le gana al borrador de familia', () => {
    const view = pick([
      book({ id: 'f', stage: 'draft', updatedAt: 9 }),
      book({ id: 'e', channel: 'events', stage: 'preview', updatedAt: 1 }),
    ]);
    expect(view).toMatchObject({ line: 'events', next: { book: { id: 'e' } } });
  });

  it('una muestra sin comprar le gana a un pedido en curso', () => {
    const view = pick([book({ stage: 'draft' })], [order({ status: 'in_production' })]);
    expect(view.next?.kind).toBe('draft');
  });

  it('una muestra profesional que gana pone el modo Pro, sin «Lo próximo»', () => {
    const view = pick([
      book({ id: 'p', channel: 'professionals', stage: 'preview' }),
      book({ id: 'f', stage: 'draft' }),
    ]);
    expect(view).toEqual({ line: 'professionals', reason: 'book', pro: true, next: null });
  });

  it('a una cuenta Pro con un cuento de familia más avanzado le manda Familias', () => {
    const view = pick(
      [
        book({ id: 'p', channel: 'professionals', stage: 'draft' }),
        book({ id: 'f', stage: 'preview' }),
      ],
      [],
      { proProfile: true },
    );
    expect(view).toMatchObject({ line: 'families', pro: false, next: { book: { id: 'f' } } });
  });
});

describe('pickHomeLine · regla 2: un pedido en curso', () => {
  it('impreso en curso: en camino cuando salió de imprenta, si no, en preparación', () => {
    expect(pick([], [order({ status: 'shipped' })])).toMatchObject({
      reason: 'order',
      next: { kind: 'order', shipped: true },
    });
    expect(pick([], [order({ status: 'paid' })])).toMatchObject({
      next: { kind: 'order', shipped: false },
    });
  });

  it('manda la línea del pedido y le gana al perfil Pro y a la línea recordada', () => {
    const view = pick([], [order({ channel: 'events', status: 'paid' })], {
      proProfile: true,
      remembered: 'professionals',
    });
    expect(view).toMatchObject({ line: 'events', reason: 'order', pro: false });
  });

  it('un digital listo ya no está en curso', () => {
    expect(pick([], [order({ status: 'ready', print: false })]).next).toBeNull();
  });
});

describe('pickHomeLine · regla 3: perfil profesional activado', () => {
  it('sin nada en curso, va a Profesionales en modo Pro', () => {
    expect(pick([], [], { proProfile: true })).toEqual({
      line: 'professionals',
      reason: 'profile',
      pro: true,
      next: null,
    });
  });

  it('le gana a la línea recordada y al último pedido', () => {
    const view = pick([], [order({ status: 'delivered' })], {
      proProfile: true,
      remembered: 'events',
    });
    expect(view.reason).toBe('profile');
  });
});

describe('pickHomeLine · regla 4: la línea por la que entró', () => {
  it('cuenta nueva que vino de /events', () => {
    expect(pick([], [], { remembered: 'events' })).toEqual({
      line: 'events',
      reason: 'remembered',
      pro: false,
      next: null,
    });
  });

  it('que vino de /professionals sin perfil activado: Profesionales primero, sin modo Pro', () => {
    expect(pick([], [], { remembered: 'professionals' })).toMatchObject({
      line: 'professionals',
      pro: false,
    });
  });

  it('le gana al último pedido entregado', () => {
    const view = pick([], [order({ status: 'delivered' })], { remembered: 'events' });
    expect(view.line).toBe('events');
  });

  it('solo acepta las tres líneas', () => {
    expect(parseRemembered('events')).toBe('events');
    expect(parseRemembered('otra')).toBeNull();
    expect(parseRemembered(null)).toBeNull();
  });
});

describe('pickHomeLine · regla 5: el último pedido, o Familias', () => {
  it('la línea del pedido más reciente', () => {
    const view = pick(
      [],
      [
        order({ id: 'a', channel: 'families', createdAt: 1 }),
        order({ id: 'b', channel: 'events', createdAt: 5 }),
      ],
    );
    expect(view).toMatchObject({ line: 'events', reason: 'last_order', next: null });
  });

  it('sin nada: Familias', () => {
    expect(pick([])).toEqual({ line: 'families', reason: 'default', pro: false, next: null });
  });

  it('los pedidos cancelados o reembolsados no cuentan', () => {
    expect(pick([], [order({ status: 'cancelled', channel: 'events' })]).reason).toBe('default');
    expect(pick([], [order({ status: 'refunded', channel: 'events' })]).reason).toBe('default');
  });
});

describe('pickHomeLine · modo Pro cuando todo es profesional', () => {
  it('solo pedidos profesionales entregados, sin perfil: modo Pro', () => {
    const view = pick([], [order({ channel: 'professionals', status: 'delivered' })]);
    expect(view).toMatchObject({ line: 'professionals', pro: true });
  });

  it('un pedido profesional en curso: sin «Lo próximo» porque todo es profesional', () => {
    const view = pick([], [order({ channel: 'professionals', status: 'paid' })]);
    expect(view).toMatchObject({ pro: true, next: null });
  });
});

describe('mixtos', () => {
  it('un libro en camino y un kit a medias: «Lo próximo» es el kit', () => {
    const view = pick(
      [book({ id: 'kit', channel: 'events', stage: 'preview' })],
      [order({ status: 'shipped' })],
    );
    expect(view).toMatchObject({ line: 'events', next: { kind: 'preview', book: { id: 'kit' } } });
  });

  it('las tres líneas: manda la que está más cerca de la compra', () => {
    const view = pick(
      [
        book({ id: 'f', stage: 'generating', updatedAt: 9 }),
        book({ id: 'e', channel: 'events', stage: 'character', updatedAt: 2 }),
        book({ id: 'p', channel: 'professionals', stage: 'draft', updatedAt: 10 }),
      ],
      [],
      { proProfile: true, remembered: 'professionals' },
    );
    expect(view).toMatchObject({ line: 'events', pro: false, next: { book: { id: 'e' } } });
  });
});

describe('buildHomeRows', () => {
  it('borradores y pedidos de todas las líneas juntos, del más reciente al más viejo', () => {
    const rows = buildHomeRows(
      [book({ id: 'kit', channel: 'events', updatedAt: 5 })],
      [
        order({ id: 'o', status: 'shipped', createdAt: 9 }),
        order({ id: 'x', status: 'cancelled', createdAt: 10 }),
      ],
      null,
    );
    expect(rows.map((row) => row.key)).toEqual(['order-o', 'book-kit']);
  });

  it('los libros profesionales van agrupados por proyecto, con su libro más reciente', () => {
    const rows = buildHomeRows(
      [book({ id: 'p2', channel: 'professionals', stage: 'preview', updatedAt: 7 })],
      [order({ id: 'po', bookId: 'p1', channel: 'professionals', createdAt: 3 })],
      [
        {
          childId: 'c1',
          label: 'Mati',
          books: [
            { id: 'p1', status: 'ordered', storyId: null, updatedAt: 3 },
            { id: 'p2', status: 'preview_ready', storyId: null, updatedAt: 7 },
          ],
        },
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'project',
      project: { label: 'Mati' },
      book: { id: 'p2' },
      preview: { id: 'p2' },
    });
  });
});

describe('ordersWithCover', () => {
  it('pide portada para todos los pedidos que caben en la lista, no solo los dos primeros', () => {
    // El tercer pedido comprado salía con la imagen genérica de la línea.
    expect([...ordersWithCover(['ready', 'delivered', 'delivered'])]).toEqual([0, 1, 2]);
  });

  it('no gasta lugares en pedidos que no aparecen', () => {
    expect([
      ...ordersWithCover(['pending_payment', 'cancelled', 'paid', 'refunded', 'delivered']),
    ]).toEqual([2, 4]);
  });

  it('se queda en las filas visibles de la home', () => {
    const many = Array.from({ length: 10 }, () => 'delivered');
    expect(ordersWithCover(many).size).toBe(HOME_ROWS);
  });
});
