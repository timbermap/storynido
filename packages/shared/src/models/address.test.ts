import { describe, expect, it } from 'vitest';

import { addressProblems, addressSchema } from './commerce';

const base = addressSchema.parse({
  name: 'Ana Pérez',
  line1: 'Av. Reforma 123',
  line2: null,
  city: 'Ciudad de México',
  state: 'CDMX',
  postalCode: '06600',
  country: 'MX',
  phone: '+52 55 1234 5678',
});

describe('documento de quien recibe', () => {
  const ar = {
    ...base,
    country: 'AR' as const,
    state: null,
    postalCode: 'C1425ABC',
    phone: '+54 11 5555 1234',
  };

  it('es obligatorio donde la aduana lo pide', () => {
    expect(base.taxId).toBeNull();
    expect(addressProblems(base)).toContain('taxId');
    expect(addressProblems(ar)).toContain('taxId');
  });

  it('es opcional en Uruguay y en los países sin regla', () => {
    const uy = { ...ar, country: 'UY' as const, postalCode: '11300' };
    expect(addressProblems(uy)).toEqual([]);
    expect(addressProblems({ ...uy, taxId: '1.234.567-2' })).toEqual([]);
    expect(addressProblems({ ...ar, country: 'CH' as const, postalCode: '8001' })).toEqual([]);
  });

  it('valida el documento de cada país', () => {
    expect(addressProblems({ ...base, taxId: 'XAXX010101000' })).toEqual([]);
    expect(addressProblems({ ...ar, taxId: '20-12345678-6' })).toEqual([]);
    const br = {
      ...ar,
      country: 'BR' as const,
      state: 'SP',
      postalCode: '01310-100',
    };
    expect(addressProblems({ ...br, taxId: '529.982.247-25' })).toEqual([]);
    const cl = { ...ar, country: 'CL' as const, state: 'RM', postalCode: '7500000' };
    expect(addressProblems({ ...cl, taxId: '12.345.678-5' })).toEqual([]);
    const pe = { ...ar, country: 'PE' as const, postalCode: '15046' };
    expect(addressProblems({ ...pe, taxId: '12345678' })).toEqual([]);
  });

  it('rechaza un documento con el verificador mal o con otra forma', () => {
    expect(addressProblems({ ...base, taxId: '12' })).toContain('taxId');
    expect(addressProblems({ ...base, taxId: 'mi casa; drop' })).toContain('taxId');
    // La CURP no sirve: Lulu pide el RFC.
    expect(addressProblems({ ...base, taxId: 'GODE561231HDFRRN09' })).toContain('taxId');
    expect(addressProblems({ ...ar, taxId: '20-12345678-5' })).toContain('taxId');
    expect(
      addressProblems({
        ...ar,
        country: 'BR',
        state: 'SP',
        postalCode: '01310100',
        taxId: '111.111.111-11',
      }),
    ).toContain('taxId');
    expect(
      addressProblems({
        ...ar,
        country: 'CL',
        state: 'RM',
        postalCode: '7500000',
        taxId: '12.345.678-K',
      }),
    ).toContain('taxId');
  });
});

describe('código postal y estado por país', () => {
  const withId = { ...base, taxId: 'XAXX010101000' };

  it('acepta los formatos de cada país', () => {
    const cases = [
      { country: 'AR', postalCode: 'c1425abc', taxId: '20123456786' },
      { country: 'AR', postalCode: '5000', taxId: '20123456786' },
      { country: 'UY', postalCode: '11300', taxId: null },
      { country: 'CO', postalCode: '110111', taxId: null },
      { country: 'ES', postalCode: '28013', taxId: null },
    ] as const;
    for (const item of cases) {
      expect(addressProblems({ ...withId, ...item, state: null })).toEqual([]);
    }
  });

  it('rechaza un código postal que no es del país', () => {
    expect(addressProblems({ ...withId, postalCode: '0660' })).toContain('postalCode');
    expect(
      addressProblems({ ...withId, country: 'UY', state: null, taxId: null, postalCode: '1130' }),
    ).toContain('postalCode');
    expect(
      addressProblems({
        ...withId,
        country: 'AR',
        state: null,
        taxId: '20123456786',
        postalCode: 'C14',
      }),
    ).toContain('postalCode');
  });

  it('pide el estado o la región en Brasil y Chile', () => {
    expect(
      addressProblems({
        ...withId,
        country: 'CL',
        state: null,
        postalCode: '7500000',
        taxId: '12.345.678-5',
      }),
    ).toContain('state');
  });
});

describe('teléfono de quien recibe', () => {
  it('es obligatorio en todos los países: la imprenta lo exige', () => {
    expect(addressProblems({ ...base, country: 'AR', state: null, phone: null })).toContain(
      'phone',
    );
    expect(
      addressProblems({ ...base, country: 'US', state: 'TX', postalCode: '78701', phone: '' }),
    ).toContain('phone');
    expect(
      addressProblems({
        ...base,
        country: 'AR',
        state: null,
        postalCode: 'C1425',
        phone: '+54 11 5555 1234',
        taxId: '20-12345678-6',
      }),
    ).toEqual([]);
  });
});
