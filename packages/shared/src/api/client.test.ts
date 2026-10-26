import { describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient } from './client';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('manda el token solo en rutas protegidas y valida la respuesta', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse(200, { uid: 'u1', email: 'a@b.com', role: 'customer' })),
    );
    const call = createApiClient({
      baseUrl: 'http://api.test',
      getIdToken: () => Promise.resolve('token-123'),
      fetch: fetchMock,
    });

    const me = await call('me');
    expect(me.role).toBe('customer');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toEqual(new URL('http://api.test/v1/me'));
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer token-123');
  });

  it('no manda el token a rutas públicas', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(jsonResponse(200, { mode: 'live' })),
    );
    const call = createApiClient({
      baseUrl: 'http://api.test',
      getIdToken: () => Promise.resolve('token-123'),
      fetch: fetchMock,
    });
    await call('siteConfig');
    expect(
      (fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>).authorization,
    ).toBeUndefined();
  });

  it('convierte errores de la API en ApiError', async () => {
    const call = createApiClient({
      baseUrl: 'http://api.test',
      fetch: () =>
        Promise.resolve(jsonResponse(403, { error: { code: 'forbidden', message: 'No' } })),
    });
    await expect(call('adminProviders')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    await expect(call('adminProviders')).rejects.toBeInstanceOf(ApiError);
  });

  it('rechaza respuestas que no cumplen el contrato', async () => {
    const call = createApiClient({
      baseUrl: 'http://api.test',
      fetch: () => Promise.resolve(jsonResponse(200, { mode: 'desconocido' })),
    });
    await expect(call('siteConfig')).rejects.toThrow();
  });
});
