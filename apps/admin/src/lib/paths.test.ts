import { describe, expect, it } from 'vitest';

import { getPath, setPath } from './paths';

describe('rutas con puntos', () => {
  it('lee y escribe anidado sin mutar el original', () => {
    const data = { code: 'MX', shipping: { costMinor: 100, etaDaysMin: 5 } };
    expect(getPath(data, 'shipping.costMinor')).toBe(100);
    expect(getPath(data, 'nada.que.ver')).toBeUndefined();
    const next = setPath(data, 'shipping.costMinor', 200);
    expect(next).toEqual({ code: 'MX', shipping: { costMinor: 200, etaDaysMin: 5 } });
    expect(data.shipping.costMinor).toBe(100);
    expect(setPath({}, 'formats.digital', true)).toEqual({ formats: { digital: true } });
  });
});
