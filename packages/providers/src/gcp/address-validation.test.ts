import { describe, expect, it } from 'vitest';

import { GoogleAddressValidator, verdictFrom } from './address-validation';

const address = {
  name: 'Ana',
  line1: 'Av. San Martín 1234',
  line2: null,
  city: 'Rosario',
  state: 'Santa Fe',
  postalCode: 'S2000',
  country: 'AR' as const,
  phone: '+54 341 555 1234',
};

describe('Address Validation', () => {
  it('confirmada: se entrega, con la ubicación de Google', () => {
    expect(
      verdictFrom({
        result: {
          verdict: { possibleNextAction: 'ACCEPT', addressComplete: true },
          geocode: { location: { latitude: -32.95, longitude: -60.65 } },
        },
      }),
    ).toEqual({ status: 'ok', reasons: [], location: { lat: -32.95, lng: -60.65 } });
  });

  it('para corregir: dice qué falta o no se confirmó', () => {
    const verdict = verdictFrom({
      result: {
        verdict: { possibleNextAction: 'FIX' },
        address: {
          missingComponentTypes: ['street_number'],
          unconfirmedComponentTypes: ['route', 'neighborhood'],
        },
      },
    });
    expect(verdict.status).toBe('fix');
    expect(verdict.reasons).toEqual(['falta street_number', 'no confirmado route']);
  });

  it('"confirmar el depto." no frena: solo FIX', () => {
    expect(
      verdictFrom({ result: { verdict: { possibleNextAction: 'CONFIRM_ADD_SUBPREMISES' } } })
        .status,
    ).toBe('ok');
  });

  it('Uruguay no tiene datos: no se llama a Google', async () => {
    let calls = 0;
    const validator = new GoogleAddressValidator({
      projectId: 'p',
      getAccessToken: () => Promise.resolve('t'),
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(new Response('{}'));
      },
    });
    expect((await validator.validate({ ...address, country: 'UY' })).status).toBe('unsupported');
    expect(calls).toBe(0);
  });

  it('llama con OAuth, factura al proyecto y manda la dirección escrita', async () => {
    let request: { url: string; init: RequestInit } | null = null;
    const validator = new GoogleAddressValidator({
      projectId: 'storynido-staging',
      getAccessToken: () => Promise.resolve('token'),
      fetchImpl: ((url: string, init: RequestInit) => {
        request = { url, init };
        return Promise.resolve(
          new Response(JSON.stringify({ result: { verdict: { possibleNextAction: 'ACCEPT' } } })),
        );
      }) as unknown as typeof fetch,
    });
    expect((await validator.validate(address)).status).toBe('ok');
    const sent = request as unknown as { url: string; init: RequestInit };
    expect(sent.url).toContain('addressvalidation.googleapis.com');
    expect(sent.init.headers).toMatchObject({
      Authorization: 'Bearer token',
      'X-Goog-User-Project': 'storynido-staging',
    });
    expect(JSON.parse(sent.init.body as string)).toMatchObject({
      address: { regionCode: 'AR', addressLines: ['Av. San Martín 1234'], locality: 'Rosario' },
    });
  });
});
