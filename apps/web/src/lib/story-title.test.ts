import { describe, expect, it } from 'vitest';

import { titleForChild } from './story-title';

describe('titleForChild', () => {
  it('pone el nombre del chico en lugar del personaje de ejemplo', () => {
    expect(
      titleForChild(
        { title: 'Benja y el valle de los dinosaurios', castName: 'Benja' },
        'Toto',
        'es',
      ),
    ).toBe('Toto y el valle de los dinosaurios');
    // En inglés el personaje de ejemplo se adapta (Benja → Ben).
    expect(
      titleForChild({ title: 'Ben, Superhero for a Day', castName: 'Benja' }, 'Toto', 'en'),
    ).toBe('Toto, Superhero for a Day');
  });

  it('sin nombre, sin personaje de ejemplo o sin coincidencia, deja el título', () => {
    expect(titleForChild({ title: 'Buenas noches, Lola', castName: 'Lola' }, '  ', 'es')).toBe(
      'Buenas noches, Lola',
    );
    expect(titleForChild({ title: 'El bosque', castName: undefined }, 'Toto', 'es')).toBe(
      'El bosque',
    );
    expect(titleForChild({ title: 'El bosque', castName: 'Benja' }, 'Toto', 'es')).toBe(
      'El bosque',
    );
  });
});
