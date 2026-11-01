import { describe, expect, it } from 'vitest';

import { clean } from './client-errors';

describe('limpieza de errores del navegador', () => {
  it('quita correos, parámetros de búsqueda e ids largos', () => {
    const text =
      'Falló ana@correo.com en https://x.com/es/pedido/AbCdEfGhIjKlMnOpQrSt?token=abc#frag';
    const cleaned = clean(text);
    expect(cleaned).not.toContain('ana@correo.com');
    expect(cleaned).not.toContain('token=abc');
    expect(cleaned).not.toContain('AbCdEfGhIjKlMnOpQrSt');
  });

  it('deja intacto un mensaje común', () => {
    expect(clean('Cannot read properties of undefined')).toBe(
      'Cannot read properties of undefined',
    );
  });
});
