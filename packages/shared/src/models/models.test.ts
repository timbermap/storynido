import { describe, expect, it } from 'vitest';

import { childSchema, createConverter, normalizeFirestoreData, orderSchema } from './index';

const fakeTimestamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe('normalizeFirestoreData', () => {
  it('convierte Timestamp anidados en Date', () => {
    const data = normalizeFirestoreData({
      at: fakeTimestamp('2026-01-01T00:00:00Z'),
      nested: { list: [fakeTimestamp('2026-02-01T00:00:00Z'), 'x'] },
      plain: 3,
    }) as { at: Date; nested: { list: [Date, string] }; plain: number };
    expect(data.at).toBeInstanceOf(Date);
    expect(data.nested.list[0].toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(data.plain).toBe(3);
  });
});

describe('createConverter', () => {
  const converter = createConverter(childSchema);
  const child = {
    ownerUid: 'u1',
    name: 'Martina',
    age: 5,
    pronouns: 'she' as const,
    likes: ['dinosaurios'],
    petName: null,
    bestFriendName: 'Tomi',
    createdAt: fakeTimestamp('2026-10-26T00:00:00Z'),
    updatedAt: fakeTimestamp('2026-10-26T00:00:00Z'),
  };

  it('valida y normaliza al leer', () => {
    const parsed = converter.fromFirestore({ data: () => child });
    expect(parsed.name).toBe('Martina');
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });

  it('rechaza documentos inválidos', () => {
    expect(() => converter.fromFirestore({ data: () => ({ ...child, age: 30 }) })).toThrow();
  });
});

describe('schemas', () => {
  it('limita la cantidad de gustos del chico', () => {
    const base = {
      ownerUid: 'u1',
      name: 'Leo',
      age: 4,
      pronouns: null,
      petName: null,
      bestFriendName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(childSchema.safeParse({ ...base, likes: Array(10).fill('x') }).success).toBe(true);
    expect(childSchema.safeParse({ ...base, likes: Array(11).fill('x') }).success).toBe(false);
  });

  it('los montos del pedido son enteros en unidad mínima', () => {
    const amounts = orderSchema.shape.amounts;
    expect(
      amounts.safeParse({
        subtotalMinor: 49900,
        discountMinor: 0,
        shippingMinor: 9900,
        taxMinor: 0,
        totalMinor: 59800,
      }).success,
    ).toBe(true);
    expect(
      amounts.safeParse({
        subtotalMinor: 499.9,
        discountMinor: 0,
        shippingMinor: 0,
        taxMinor: 0,
        totalMinor: 499.9,
      }).success,
    ).toBe(false);
  });
});
