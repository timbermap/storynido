import { describe, expect, it } from 'vitest';

import { showcaseReasons, type ShowcaseCandidate } from './showcase';

const good: ShowcaseCandidate = {
  caseId: 'pro-sonido-3',
  goldenIds: ['pro-sonido-3', 'fam-mama-5'],
  title: 'Abril y el sonido escondido',
  pages: ['Abril escucha a los pájaros.', 'Sss, dice el viento.'],
  clauses: { closed_cast: 'pass', same_outfit: 'repaired', exact_refrain: 'soft' },
  panel: { score: 4, errors: [], buyer: { verdict: 'compra' } },
};

describe('libros de ejemplo de la mesa (DECISIONS 348)', () => {
  it('califica con nota 4, el comprador lo compra y sin fallas duras', () => {
    expect(showcaseReasons(good)).toEqual([]);
  });

  it('solo libros del golden set', () => {
    expect(showcaseReasons({ ...good, caseId: 'pedido-real' })).toContain('no es del golden set');
  });

  it('pide nota 4 o más y que el comprador lo compre', () => {
    const low = showcaseReasons({
      ...good,
      panel: { score: 3, errors: [], buyer: { verdict: 'duda' } },
    });
    expect(low).toEqual(['nota de la mesa 3 (mínimo 4)', 'el comprador no lo compraría (duda)']);
  });

  it('una falla dura del contrato o una mesa incompleta lo dejan afuera', () => {
    expect(showcaseReasons({ ...good, clauses: { ...good.clauses, no_touch: 'fail' } })).toEqual([
      'fallas duras: no_touch',
    ]);
    expect(
      showcaseReasons({
        ...good,
        panel: { score: 4, errors: ['continuidad: timeout'], buyer: { verdict: 'compra' } },
      }),
    ).toEqual(['la mesa no terminó (un juez falló)']);
    expect(showcaseReasons({ ...good, panel: null })).toContain('no pasó por la mesa de jueces');
  });

  it('nunca el libro de Angelica (DECISIONS 253)', () => {
    expect(showcaseReasons({ ...good, title: 'Angélica y el sonido escondido' })).toContain(
      'nombra a una persona real (DECISIONS 253)',
    );
  });
});
