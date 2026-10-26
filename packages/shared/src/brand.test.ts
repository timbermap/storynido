import { describe, expect, it } from 'vitest';

import { DEFAULT_BRAND_DOMAIN, DEFAULT_BRAND_NAME, getBrandConfig } from './brand';

describe('brand', () => {
  it('usa los valores por defecto si no hay variables', () => {
    expect(getBrandConfig({})).toEqual({ name: DEFAULT_BRAND_NAME, domain: DEFAULT_BRAND_DOMAIN });
  });

  it('respeta las variables de servidor y de cliente', () => {
    expect(getBrandConfig({ BRAND_NAME: 'CuentaMágica' }).name).toBe('CuentaMágica');
    expect(getBrandConfig({ NEXT_PUBLIC_BRAND_DOMAIN: 'staging.storynido.com' }).domain).toBe(
      'staging.storynido.com',
    );
  });

  it('rechaza dominios inválidos', () => {
    expect(() => getBrandConfig({ BRAND_DOMAIN: 'https://storynido.com/' })).toThrow();
  });
});
