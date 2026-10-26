import { afterAll, describe, expect, it } from 'vitest';

import { buildApp } from './app';

describe('worker', () => {
  const app = buildApp({ version: 'test' });

  afterAll(async () => {
    await app.close();
  });

  it('responde el health check', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'worker', version: 'test' });
  });

  it('devuelve 404 en rutas inexistentes', async () => {
    const res = await app.inject({ method: 'GET', url: '/no-existe' });
    expect(res.statusCode).toBe(404);
  });
});
