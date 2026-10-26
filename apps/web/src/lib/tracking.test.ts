import { describe, expect, it } from 'vitest';

import { isPrivatePath } from './tracking';

describe('isPrivatePath', () => {
  it('excluye el creador, la cuenta y el acceso en todos los idiomas', () => {
    for (const path of [
      '/es/crear',
      '/es/crear/abc123',
      '/en/create/abc123',
      '/pt/criar/abc123/',
      '/es/cuenta',
      '/en/account',
      '/pt/conta',
      '/es/ingresar',
      '/es/ingresar/confirmar',
      '/en/login/finish',
      '/pt/entrar',
    ]) {
      expect(isPrivatePath(path), path).toBe(true);
    }
  });

  it('deja medir las páginas públicas', () => {
    for (const path of [
      '/es',
      '/es/historias',
      '/en/stories/aventura-espacial',
      '/es/blog',
      '/es/crearte',
    ]) {
      expect(isPrivatePath(path), path).toBe(false);
    }
  });
});
