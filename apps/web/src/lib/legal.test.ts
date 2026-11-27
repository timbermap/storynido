import { describe, expect, it } from 'vitest';

import { legalDocumentFromAnySlug, legalDocumentFromSlug } from './legal';

describe('legalDocumentFromAnySlug', () => {
  it('encuentra el documento con el slug de otro idioma', () => {
    expect(legalDocumentFromSlug('es', 'privacy')).toBeNull();
    expect(legalDocumentFromAnySlug('privacy')).toBe('privacy');
    expect(legalDocumentFromAnySlug('termos')).toBe('terms');
    expect(legalDocumentFromAnySlug('envios')).toBe('shipping');
  });

  it('da null con un slug que no existe', () => {
    expect(legalDocumentFromAnySlug('nada')).toBeNull();
  });
});
