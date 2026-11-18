import { describe, expect, it } from 'vitest';

import { creatorReturn } from './after-login';

describe('volver al creador después de entrar', () => {
  it('acepta solo la portada del creador en cada idioma', () => {
    expect(creatorReturn('/es/crear')).toBe('/es/crear');
    expect(creatorReturn('/en/create/')).toBe('/en/create');
    expect(creatorReturn('/pt/criar')).toBe('/pt/criar');
    expect(creatorReturn('/es/crear/abc123')).toBeNull();
    expect(creatorReturn('/es/mi-cuenta')).toBeNull();
  });

  it('lee el next de la página de ingresar guardada para el enlace mágico', () => {
    expect(creatorReturn('/es/ingresar?next=%2Fes%2Fcrear')).toBe('/es/crear');
    expect(creatorReturn('/es/ingresar?next=/es/pedido/1')).toBeNull();
    expect(creatorReturn('/es/ingresar')).toBeNull();
  });

  it('nunca sale del sitio', () => {
    expect(creatorReturn('//otro.com/es/crear')).toBeNull();
    expect(creatorReturn('https://otro.com/es/crear')).toBeNull();
    expect(creatorReturn('/es/ingresar?next=//otro.com/es/crear')).toBeNull();
    expect(creatorReturn(null)).toBeNull();
  });
});
