import { describe, expect, it } from 'vitest';

import { AREAS, NAV_ITEMS, areaOfPath, itemsOfArea, searchNav } from './nav';

describe('búsqueda del menú', () => {
  it('sin texto muestra todo; con texto busca en el nombre y las palabras clave', () => {
    expect(searchNav('  ')).toEqual(NAV_ITEMS);
    expect(searchNav('mantenimiento').map((item) => item.href)).toEqual(['/site']);
    expect(searchNav('IA presupuesto').map((item) => item.href)).toEqual(['/ai']);
    expect(searchNav('nada que ver')).toEqual([]);
  });
});

describe('áreas del panel', () => {
  it('cada pantalla está en un área y no queda ninguna afuera', () => {
    const all = AREAS.flatMap((area) => itemsOfArea(area).map((item) => item.href));
    expect(all.toSorted()).toEqual(NAV_ITEMS.map((item) => item.href).toSorted());
  });
  it('detecta el área por la ruta, también en las pantallas de detalle', () => {
    expect(areaOfPath('/')).toBe('General');
    expect(areaOfPath('/print-options/')).toBe('Operaciones');
    expect(areaOfPath('/order')).toBe('Administración');
    expect(areaOfPath('/customer')).toBe('Usuarios');
  });
});
