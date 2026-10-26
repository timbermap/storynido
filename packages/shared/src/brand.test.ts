import { describe, expect, it } from 'vitest';

import { DEFAULT_BRAND_NAME, getBrandConfig } from './brand';

describe('brand', () => {
  it('usa el nombre por defecto si no hay variable', () => {
    expect(getBrandConfig({}).name).toBe(DEFAULT_BRAND_NAME);
  });

  it('respeta BRAND_NAME y NEXT_PUBLIC_BRAND_NAME', () => {
    expect(getBrandConfig({ BRAND_NAME: 'CuentaMágica' }).name).toBe('CuentaMágica');
    expect(getBrandConfig({ NEXT_PUBLIC_BRAND_NAME: 'StoryMe' }).name).toBe('StoryMe');
  });
});
