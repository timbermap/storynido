import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('combina clases y resuelve conflictos de Tailwind', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('text-sm', false, undefined, 'font-bold')).toBe('text-sm font-bold');
  });
});
