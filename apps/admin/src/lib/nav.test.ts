import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, searchNav } from './nav';

describe('búsqueda del menú', () => {
  it('sin texto muestra todo; con texto busca en el nombre y las palabras clave', () => {
    expect(searchNav('  ')).toEqual(NAV_ITEMS);
    expect(searchNav('mantenimiento').map((item) => item.href)).toEqual(['/site']);
    expect(searchNav('IA presupuesto').map((item) => item.href)).toEqual(['/ai']);
    expect(searchNav('nada que ver')).toEqual([]);
  });
});
