import { ApiError } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import pt from '../../../messages/pt.json';

import { previewErrorKey } from './preview-errors';

describe('errores de la muestra', () => {
  it('el presupuesto diario agotado tiene su propio aviso (no «intenta en unos minutos»)', () => {
    const error = new ApiError(
      503,
      'ai_budget_exhausted',
      'Alcanzamos el límite de generación por hoy.',
    );
    expect(previewErrorKey(error)).toBe('ai_budget_exhausted');
    for (const messages of [es, en, pt]) {
      const text = messages.Wizard.preview.errors.ai_budget_exhausted;
      expect(text).toBeTruthy();
      expect(text).not.toBe(messages.Wizard.preview.errors.ai_unavailable);
    }
  });

  it('una caída del proveedor sigue siendo ai_unavailable', () => {
    expect(previewErrorKey(new ApiError(503, 'ai_unavailable', 'x'))).toBe('ai_unavailable');
    expect(previewErrorKey(new Error('x'))).toBe('generic');
  });
});
