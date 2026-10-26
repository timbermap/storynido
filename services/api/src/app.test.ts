import { apiErrorSchema, apiRoutes } from '@storynido/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { addRoute } from './plugins/route';
import { auth, createTestApp } from './test-helpers';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

describe('api', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('responde el health check', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'api', version: 'test' });
  });

  describe('autenticación y roles', () => {
    it('una ruta protegida rechaza sin token', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/v1/me' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: { code: 'unauthorized' } });
      expect(apiErrorSchema.safeParse(res.json()).success).toBe(true);
    });

    it('rechaza un token inválido', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth('basura') });
      expect(res.statusCode).toBe(401);
    });

    it('rechaza un header Authorization mal formado', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: 'Token abc' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('con sesión devuelve el usuario y su rol (sin claim = customer)', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: auth('token-ana'),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ uid: 'ana', email: 'ana@storynido.test', role: 'customer' });
    });

    it('una ruta de admin rechaza a un customer con 403', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/v1/admin/providers',
        headers: auth('token-ana'),
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ error: { code: 'forbidden' } });
    });

    it('admin y superadmin acceden a rutas de admin', async () => {
      for (const token of ['token-root:admin', 'token-root:superadmin']) {
        const res = await ctx.app.inject({
          method: 'GET',
          url: '/v1/admin/providers',
          headers: auth(token),
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ active: { payment: 'mock', storage: 'local' } });
      }
    });
  });

  describe('modo del sitio', () => {
    it('en mantenimiento bloquea a los clientes pero no a los admins ni al health', async () => {
      ctx.siteConfig.current = 'maintenance';
      try {
        expect(
          (await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth('token-ana') }))
            .statusCode,
        ).toBe(503);
        expect(
          (
            await ctx.app.inject({
              method: 'GET',
              url: '/v1/me',
              headers: auth('token-root:admin'),
            })
          ).statusCode,
        ).toBe(200);
        expect((await ctx.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
        const site = await ctx.app.inject({ method: 'GET', url: '/v1/site-config' });
        expect(site.json()).toEqual({ mode: 'maintenance' });
      } finally {
        ctx.siteConfig.current = 'live';
      }
    });
  });

  describe('errores', () => {
    it('404 con el formato único', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/no-existe' });
      expect(res.statusCode).toBe(404);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('not_found');
    });
  });

  describe('seguridad', () => {
    it('agrega cabeceras de seguridad', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/health' });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('CORS solo para orígenes permitidos', async () => {
      const allowed = await ctx.app.inject({
        method: 'OPTIONS',
        url: '/v1/me',
        headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
      });
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      const denied = await ctx.app.inject({
        method: 'OPTIONS',
        url: '/v1/me',
        headers: { origin: 'https://malicioso.example', 'access-control-request-method': 'GET' },
      });
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('OpenAPI', () => {
    it('/docs muestra la especificación con las rutas del contrato', async () => {
      expect((await ctx.app.inject({ method: 'GET', url: '/docs' })).statusCode).toBeLessThan(400);
      const spec = (await ctx.app.inject({ method: 'GET', url: '/docs/json' })).json<{
        paths: Record<string, unknown>;
      }>();
      // OpenAPI escribe los parámetros como {slug}; el contrato, como :slug.
      for (const route of Object.values(apiRoutes)) {
        expect(Object.keys(spec.paths)).toContain(route.path.replace(/:(\w+)/g, '{$1}'));
      }
      expect(spec.paths).not.toHaveProperty('/dev/storage/{bucket}/*');
    });
  });
});

describe('rate limiting', () => {
  it('limita por usuario y por IP', async () => {
    const { app } = await createTestApp({}, { RATE_LIMIT_PER_MINUTE: '3' });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 4; i++) {
        codes.push((await app.inject({ method: 'GET', url: '/v1/site-config' })).statusCode);
      }
      expect(codes).toEqual([200, 200, 200, 429]);
      const limited = await app.inject({ method: 'GET', url: '/v1/site-config' });
      expect(limited.json()).toMatchObject({ error: { code: 'rate_limited' } });
      // Otro usuario tiene su propio cupo.
      expect(
        (await app.inject({ method: 'GET', url: '/v1/me', headers: auth('token-bob') })).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
  });
});

describe('App Check', () => {
  const probe = {
    method: 'GET',
    path: '/v1/test/app-check',
    access: 'public',
    summary: 'Ruta de prueba sensible',
    response: apiRoutes.siteConfig.response,
  } as const;

  it('si está activado, exige un token válido en las rutas sensibles', async () => {
    const { app } = await createTestApp({}, { APP_CHECK_ENFORCED: 'true' }, (instance) => {
      addRoute(instance, probe, { appCheck: true }, () => ({ mode: 'live' as const }));
    });
    try {
      expect((await app.inject({ method: 'GET', url: probe.path })).statusCode).toBe(401);
      const bad = await app.inject({
        method: 'GET',
        url: probe.path,
        headers: { 'x-firebase-appcheck': 'falso' },
      });
      expect(bad.json()).toMatchObject({ error: { code: 'app_check_failed' } });
      const good = await app.inject({
        method: 'GET',
        url: probe.path,
        headers: { 'x-firebase-appcheck': 'valid-app-check' },
      });
      expect(good.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('si está desactivado (desarrollo), no lo exige', async () => {
    const { app } = await createTestApp({}, { APP_CHECK_ENFORCED: 'false' }, (instance) => {
      addRoute(instance, probe, { appCheck: true }, () => ({ mode: 'live' as const }));
    });
    try {
      expect((await app.inject({ method: 'GET', url: probe.path })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

describe('storage local (/dev/storage)', () => {
  it('sube y descarga con URLs firmadas y rechaza firmas inválidas', async () => {
    const { app, providers } = await createTestApp();
    try {
      const storage = providers.storage();
      const ref = { bucket: 'photos' as const, path: 'ana/foto.jpg' };
      const upload = new URL((await storage.signedUploadUrl(ref, 'image/jpeg', 60)).url);
      const put = await app.inject({
        method: 'PUT',
        url: upload.pathname + upload.search,
        headers: { 'content-type': 'image/jpeg' },
        payload: Buffer.from([0xff, 0xd8, 0xff]),
      });
      expect(put.statusCode).toBe(204);

      const download = new URL((await storage.signedDownloadUrl(ref, 60)).url);
      const get = await app.inject({ method: 'GET', url: download.pathname + download.search });
      expect(get.statusCode).toBe(200);
      expect(get.headers['content-type']).toBe('image/jpeg');
      expect(get.rawPayload).toEqual(Buffer.from([0xff, 0xd8, 0xff]));

      const tampered = download.search.replace(/sig=[0-9a-f]+/, 'sig=00');
      expect(
        (await app.inject({ method: 'GET', url: download.pathname + tampered })).statusCode,
      ).toBe(403);
      const wrongType = await app.inject({
        method: 'PUT',
        url: upload.pathname + upload.search,
        headers: { 'content-type': 'text/html' },
        payload: '<script>',
      });
      expect(wrongType.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('no existe en producción', async () => {
    const { app } = await createTestApp({}, { APP_ENV: 'production' });
    try {
      expect(
        (await app.inject({ method: 'GET', url: '/dev/storage/photos/x.jpg' })).statusCode,
      ).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/docs' })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
