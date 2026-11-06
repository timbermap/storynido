import { describe, expect, it } from 'vitest';

import { metersBetween, parseAddressComponents, type AddressComponent } from './google-maps';

const c = (types: string[], longText: string, shortText = longText): AddressComponent => ({
  types,
  longText,
  shortText,
});

describe('autocompletado de Google → campos de la dirección', () => {
  it('Argentina: calle y número, localidad, provincia con nombre y CPA armado', () => {
    const parsed = parseAddressComponents([
      c(['street_number'], '1234'),
      c(['route'], 'Avenida San Martín', 'Av. San Martín'),
      c(['locality', 'political'], 'Rosario'),
      c(['administrative_area_level_2', 'political'], 'Rosario'),
      c(['administrative_area_level_1', 'political'], 'Santa Fe', 'S'),
      c(['country', 'political'], 'Argentina', 'AR'),
      c(['postal_code'], 'S2000'),
      c(['postal_code_suffix'], 'ABC'),
    ]);
    expect(parsed).toEqual({
      line1: 'Avenida San Martín 1234',
      missingNumber: false,
      city: 'Rosario',
      state: 'Santa Fe',
      postalCode: 'S2000ABC',
      country: 'AR',
    });
  });

  it('una avenida sin número de puerta: hay que pedirlo', () => {
    const parsed = parseAddressComponents([
      c(['route'], 'Avenida 18 de Julio'),
      c(['locality'], 'Montevideo'),
      c(['administrative_area_level_1'], 'Departamento de Montevideo', 'MO'),
      c(['country'], 'Uruguay', 'UY'),
    ]);
    expect(parsed.missingNumber).toBe(true);
    expect(parsed.line1).toBe('Avenida 18 de Julio');
    expect(parsed.postalCode).toBe('');
  });

  it('EE. UU. y Brasil: número delante en EE. UU. y código del estado', () => {
    const us = parseAddressComponents([
      c(['street_number'], '350'),
      c(['route'], '5th Avenue', '5th Ave'),
      c(['locality'], 'New York'),
      c(['administrative_area_level_1'], 'New York', 'NY'),
      c(['country'], 'United States', 'US'),
      c(['postal_code'], '10118'),
    ]);
    expect(us.line1).toBe('350 5th Avenue');
    expect(us.state).toBe('NY');
    const br = parseAddressComponents([
      c(['street_number'], '1578'),
      c(['route'], 'Avenida Paulista'),
      c(['administrative_area_level_2'], 'São Paulo'),
      c(['administrative_area_level_1'], 'São Paulo', 'SP'),
      c(['country'], 'Brasil', 'BR'),
      c(['postal_code'], '01310-200'),
    ]);
    expect(br).toMatchObject({ line1: 'Avenida Paulista 1578', city: 'São Paulo', state: 'SP' });
  });

  it('mide cuánto se movió el pin', () => {
    const obelisco = { lat: -34.6037, lng: -58.3816 };
    expect(metersBetween(obelisco, obelisco)).toBe(0);
    const unaCuadra = metersBetween(obelisco, { lat: -34.6046, lng: -58.3816 });
    expect(unaCuadra).toBeGreaterThan(90);
    expect(unaCuadra).toBeLessThan(110);
  });
});
