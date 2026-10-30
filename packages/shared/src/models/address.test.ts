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

describe('documento fiscal del destinatario', () => {
  it('es opcional: sin él la dirección está bien', () => {
    expect(base.taxId).toBeNull();
    expect(addressProblems(base)).toEqual([]);
  });

  it('acepta un RFC, un CUIT o un CPF', () => {
    for (const taxId of ['XAXX010101000', '20-12345678-6', '529.982.247-25']) {
      expect(addressProblems({ ...base, taxId })).toEqual([]);
    }
  });

  it('rechaza lo que no se parece a un documento', () => {
    expect(addressProblems({ ...base, taxId: '12' })).toContain('taxId');
    expect(addressProblems({ ...base, taxId: 'mi casa; drop' })).toContain('taxId');
  });
});
