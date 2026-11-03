import { describe, expect, it } from 'vitest';

import { defaultMyStoriesTab, parseMyStoriesTab } from './my-stories-tabs';

describe('parseMyStoriesTab', () => {
  it('acepta las cuatro solapas', () => {
    expect(parseMyStoriesTab('en-creacion')).toBe('en-creacion');
    expect(parseMyStoriesTab('en-curso')).toBe('en-curso');
    expect(parseMyStoriesTab('terminados')).toBe('terminados');
    expect(parseMyStoriesTab('personajes')).toBe('personajes');
  });

  it('ignora lo que no es una solapa', () => {
    expect(parseMyStoriesTab('pedidos')).toBeNull();
    expect(parseMyStoriesTab(null)).toBeNull();
    expect(parseMyStoriesTab(undefined)).toBeNull();
  });
});

describe('defaultMyStoriesTab', () => {
  it('abre En creación si hay borradores', () => {
    expect(defaultMyStoriesTab(2, 1)).toBe('en-creacion');
  });

  it('abre En curso si no hay borradores pero sí pedidos en camino', () => {
    expect(defaultMyStoriesTab(0, 1)).toBe('en-curso');
  });

  it('abre Terminados si no hay nada en proceso', () => {
    expect(defaultMyStoriesTab(0, 0)).toBe('terminados');
  });
});
