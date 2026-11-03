import { describe, expect, it } from 'vitest';

import { addBusinessDays } from './order-state';

describe('addBusinessDays', () => {
  it('salta los sábados y domingos', () => {
    // Viernes 6 de noviembre de 2026 + 1 día hábil = lunes 9.
    const friday = new Date(2026, 10, 6, 12).getTime();
    expect(new Date(addBusinessDays(friday, 1)).getDate()).toBe(9);
    // + 5 días hábiles = viernes 13.
    expect(new Date(addBusinessDays(friday, 5)).getDate()).toBe(13);
  });

  it('cero días es la misma fecha', () => {
    const day = new Date(2026, 10, 3, 12).getTime();
    expect(addBusinessDays(day, 0)).toBe(day);
  });
});
