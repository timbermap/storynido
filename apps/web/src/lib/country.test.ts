import { describe, expect, it } from 'vitest';

import { detectCountry, parseCountry, resolveDisplayCountry } from './country';

const headers = (values: Record<string, string>) => new Headers(values);

describe('país', () => {
  it('prioriza el header de geolocalización', () => {
    expect(
      detectCountry(headers({ 'x-client-country': 'co', 'accept-language': 'en-US' }), 'es'),
    ).toBe('CO');
  });

  it('sin geolocalización usa la región del navegador', () => {
    expect(detectCountry(headers({ 'accept-language': 'es-CL,es;q=0.9' }), 'es')).toBe('CL');
  });

  it('si no sabe nada, usa el país principal del idioma', () => {
    expect(detectCountry(headers({}), 'en')).toBe('US');
    expect(detectCountry(headers({ 'x-client-country': 'ZZ' }), 'pt')).toBe('BR');
  });

  it('valida códigos', () => {
    expect(parseCountry('mx')).toBe('MX');
    expect(parseCountry('AR')).toBeNull();
    expect(parseCountry(undefined)).toBeNull();
  });

  it('muestra precios de un país donde se vende', () => {
    expect(resolveDisplayCountry('MX', ['MX', 'US'], 'es')).toEqual({
      country: 'MX',
      fallback: false,
    });
    expect(resolveDisplayCountry('CO', ['MX', 'US'], 'es')).toEqual({
      country: 'MX',
      fallback: true,
    });
    expect(resolveDisplayCountry('BR', ['MX', 'US'], 'pt')).toEqual({
      country: 'MX',
      fallback: true,
    });
    expect(resolveDisplayCountry('BR', [], 'pt')).toEqual({ country: 'BR', fallback: false });
  });
});
