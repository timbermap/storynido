import { describe, expect, it } from 'vitest';

import { withoutUnaskedHug, withTextGoal } from './plan-guards';

describe('arreglos del plan (libro de Angélica, 25 nov 2026)', () => {
  const hug = {
    sceneGoal: "Texto: 'Papá me abraza con calor.' | Objetivo: volver a casa felices.",
    mustBeVisible: [
      'the father hugging Angélica warmly, wrapping her in his arms',
      'the large ancient pine tree',
    ],
  };

  it('saca el abrazo que el pedido no pidió', () => {
    const fixed = withoutUnaskedHug(hug, false);
    expect(fixed.sceneGoal).toContain('sin abrazo');
    expect(fixed.mustBeVisible[0]).toContain('side by side');
    expect(fixed.mustBeVisible[1]).toBe('the large ancient pine tree');
  });

  it('si el pedido lo pide, lo deja', () => {
    expect(withoutUnaskedHug(hug, true)).toBe(hug);
  });

  it('una escena sin abrazo queda igual', () => {
    const calm = { sceneGoal: 'Objetivo: escuchar.', mustBeVisible: ['a yellow bird'] };
    expect(withoutUnaskedHug(calm, false)).toBe(calm);
  });

  it("una página con texto no conserva «Texto: ''»", () => {
    expect(withTextGoal("Texto: '' | Objetivo: Ver al pajarito amarillo.")).toBe(
      'Objetivo: Ver al pajarito amarillo. (esta página lleva texto)',
    );
    expect(withTextGoal("Texto: 'Hola' | Objetivo: x")).toBe("Texto: 'Hola' | Objetivo: x");
  });
});
