import { describe, expect, it } from 'vitest';

import { suggestAccent } from './name-accent';

describe('suggestAccent', () => {
  it('sugiere la tilde de un nombre frecuente', () => {
    expect(suggestAccent('Angelica')).toBe('Angélica');
    expect(suggestAccent(' tomas ')).toBe('Tomás');
  });

  it('no sugiere si ya tiene tilde ni si el nombre no lleva', () => {
    expect(suggestAccent('Angélica')).toBeNull();
    expect(suggestAccent('Martina')).toBeNull();
    expect(suggestAccent('')).toBeNull();
  });
});
