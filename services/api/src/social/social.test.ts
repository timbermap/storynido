import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import {
  instagramProvider,
  pinterestProvider,
  type ReadExtras,
  SocialError,
  tiktokAuth,
  tiktokAuthorizeUrl,
  tiktokProvider,
  type SocialProvider,
  type TokenStore,
} from './providers';
import { buildNetworkReport, SocialService } from './service';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const memoryTokens = (): TokenStore & { saved: Record<string, string> } => {
  const saved: Record<string, string> = {};
  return {
    saved,
    get: (network) => Promise.resolve(saved[network] ?? null),
    set: (network, token) => {
      saved[network] = token;
      return Promise.resolve();
    },
  };
};

describe('pinterestProvider', () => {
  it('lee seguidores y los días cerrados (READY) con el token', async () => {
    const urls: string[] = [];
    const fetcher = ((url: string, init?: RequestInit) => {
      urls.push(url);
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
      if (url.includes('/user_account/analytics')) {
        return Promise.resolve(
          reply({
            all: {
              daily_metrics: [
                {
                  date: '2026-11-19',
                  data_status: 'READY',
                  metrics: { IMPRESSION: 40, OUTBOUND_CLICK: 3 },
                },
                { date: '2026-11-20', data_status: 'PROCESSING', metrics: { IMPRESSION: 9 } },
              ],
            },
          }),
        );
      }
      return Promise.resolve(reply({ follower_count: 12, pin_count: 5 }));
    }) as unknown as typeof fetch;
    const provider = pinterestProvider({ accessToken: 'tok' }, memoryTokens(), fetcher);
    const reading = await provider.read(3, '2026-11-21');
    expect(reading['2026-11-21']).toMatchObject({ followers: 12, posts: 5 });
    expect(reading['2026-11-19']).toMatchObject({ impressions: 40, clicks: 3 });
    expect(reading['2026-11-20']).toBeUndefined();
    expect(urls.some((u) => u.includes('start_date=2026-11-18&end_date=2026-11-20'))).toBe(true);
  });

  it('renueva el token y guarda el de renovación nuevo', async () => {
    const tokens = memoryTokens();
    const fetcher = ((url: string) => {
      if (url.endsWith('/oauth/token')) {
        return Promise.resolve(reply({ access_token: 'nuevo', refresh_token: 'rt2' }));
      }
      if (url.includes('analytics')) return Promise.resolve(reply({ all: { daily_metrics: [] } }));
      return Promise.resolve(reply({ follower_count: 1 }));
    }) as unknown as typeof fetch;
    const provider = pinterestProvider(
      { refresh: { appId: 'a', appSecret: 's', refreshToken: 'rt1' } },
      tokens,
      fetcher,
    );
    await provider.read(1, '2026-11-21');
    expect(tokens.saved.pinterest).toBe('rt2');
  });

  it('un 401 avisa que revisen el token', async () => {
    const fetcher = (() =>
      Promise.resolve(reply({ message: 'expired' }, 401))) as unknown as typeof fetch;
    const provider = pinterestProvider({ accessToken: 'x' }, memoryTokens(), fetcher);
    await expect(provider.read(1, '2026-11-21')).rejects.toThrow(/Revisá el token/);
  });
});

describe('instagramProvider', () => {
  it('lee seguidores y cada número del día cerrado por separado', async () => {
    const fetcher = ((url: string) => {
      if (url.includes('/insights')) {
        const metric = new URL(url).searchParams.get('metric');
        if (metric === 'profile_views')
          return Promise.resolve(reply({ error: { message: 'no' } }, 400));
        const value = { views: 100, reach: 60, website_clicks: 4 }[metric ?? ''] ?? 0;
        return Promise.resolve(reply({ data: [{ total_value: { value } }] }));
      }
      return Promise.resolve(reply({ followers_count: 33, media_count: 7 }));
    }) as unknown as typeof fetch;
    const provider = instagramProvider({ accessToken: 't', userId: '1' }, fetcher);
    const reading = await provider.read(1, '2026-11-21');
    expect(reading['2026-11-21']).toMatchObject({ followers: 33, posts: 7 });
    expect(reading['2026-11-20']).toEqual({ impressions: 100, reach: 60, clicks: 4 });
  });

  it('si ningún número llega y hubo error, lo muestra', async () => {
    const fetcher = ((url: string) =>
      Promise.resolve(
        url.includes('/insights')
          ? reply({ error: { message: 'Invalid OAuth' } }, 400)
          : reply({ followers_count: 1 }),
      )) as unknown as typeof fetch;
    await expect(
      instagramProvider({ accessToken: 't', userId: '1' }, fetcher).read(1, '2026-11-21'),
    ).rejects.toBeInstanceOf(SocialError);
  });
});

describe('tiktokProvider', () => {
  it('renueva el token, lee seguidores y suma las vistas de los videos', async () => {
    const tokens = memoryTokens();
    const fetcher = ((url: string) => {
      if (url.includes('/oauth/token')) {
        return Promise.resolve(reply({ access_token: 'a', refresh_token: 'rt-nuevo' }));
      }
      if (url.includes('/user/info')) {
        return Promise.resolve(
          reply({ data: { user: { follower_count: 8, likes_count: 40, video_count: 3 } } }),
        );
      }
      return Promise.resolve(
        reply({
          data: {
            videos: [
              {
                id: 'v1',
                title: 'Hola',
                create_time: 1_700_000_000,
                view_count: 10,
                like_count: 2,
              },
              { id: 'v2', view_count: 5 },
            ],
          },
        }),
      );
    }) as unknown as typeof fetch;
    const provider = tiktokProvider(
      { clientKey: 'k', clientSecret: 's', refreshToken: 'rt' },
      tokens,
      fetcher,
    );
    const extras: ReadExtras = {};
    const reading = await provider.read(1, '2026-11-21', extras);
    expect(reading['2026-11-21']).toEqual({ followers: 8, likes: 40, posts: 3, videoViews: 15 });
    expect(tokens.saved.tiktok).toBe('rt-nuevo');
    expect(extras.videos).toHaveLength(2);
    expect(extras.videos?.[0]).toMatchObject({ id: 'v1', views: 10, likes: 2 });
  });

  it('sin autorizar la cuenta avisa que falta conectar', async () => {
    const provider = tiktokProvider({ clientKey: 'k', clientSecret: 's' }, memoryTokens());
    expect(await provider.hasCredentials?.()).toBe(false);
    await expect(provider.read(1, '2026-11-21')).rejects.toThrow('Conectar TikTok');
  });

  it('sin permiso de videos igual informa los seguidores', async () => {
    const fetcher = ((url: string) => {
      if (url.includes('/oauth/token')) return Promise.resolve(reply({ access_token: 'a' }));
      if (url.includes('/user/info')) {
        return Promise.resolve(reply({ data: { user: { follower_count: 2 } } }));
      }
      return Promise.resolve(reply({ error: { message: 'scope' } }, 403));
    }) as unknown as typeof fetch;
    const provider = tiktokProvider(
      { clientKey: 'k', clientSecret: 's', refreshToken: 'rt' },
      memoryTokens(),
      fetcher,
    );
    const reading = await provider.read(1, '2026-11-21');
    expect(reading['2026-11-21']?.followers).toBe(2);
    expect(reading['2026-11-21']?.videoViews).toBeUndefined();
  });
});

describe('tiktokAuth', () => {
  it('arma la dirección de autorización con los permisos de solo lectura', () => {
    const url = new URL(
      tiktokAuthorizeUrl('key', 'https://admin.storynido.com/social', 'estado-123'),
    );
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(url.searchParams.get('scope')).toBe('user.info.basic,user.info.stats,video.list');
    expect(url.searchParams.get('redirect_uri')).toBe('https://admin.storynido.com/social');
    expect(url.searchParams.get('state')).toBe('estado-123');
  });

  it('cambia el código por tokens y guarda el de renovación', async () => {
    const tokens = memoryTokens();
    const fetcher = ((url: string) => {
      if (url.includes('/oauth/token')) {
        return Promise.resolve(reply({ access_token: 'a', refresh_token: 'rt-1' }));
      }
      return Promise.resolve(reply({ data: { user: { display_name: 'StoryNido' } } }));
    }) as unknown as typeof fetch;
    const auth = tiktokAuth({ clientKey: 'k', clientSecret: 's' }, tokens, fetcher);
    expect(await auth.connect('codigo', 'https://admin.storynido.com/social')).toEqual({
      displayName: 'StoryNido',
    });
    expect(tokens.saved.tiktok).toBe('rt-1');
  });

  it('si TikTok rechaza el código, no guarda nada', async () => {
    const tokens = memoryTokens();
    const fetcher = (() =>
      Promise.resolve(reply({ error: 'invalid_grant' }, 400))) as unknown as typeof fetch;
    const auth = tiktokAuth({ clientKey: 'k', clientSecret: 's' }, tokens, fetcher);
    await expect(auth.connect('mal', 'https://admin.storynido.com/social')).rejects.toThrow(
      SocialError,
    );
    expect(tokens.saved.tiktok).toBeUndefined();
  });
});

describe('buildNetworkReport', () => {
  const docs = [
    { day: '2026-11-19', pinterest: { followers: 10, impressions: 40, clicks: 3 } },
    { day: '2026-11-20', pinterest: { impressions: 20 } },
    { day: '2026-11-21', pinterest: { followers: 14 } },
  ];
  it('suma el período y calcula el cambio de seguidores', () => {
    const report = buildNetworkReport('pinterest', true, null, null, docs);
    expect(report).toMatchObject({
      followers: 14,
      followersChange: 4,
      impressions: 60,
      clicks: 3,
      reach: null,
      videoViews: null,
    });
    expect(report.daily).toHaveLength(3);
  });
  it('una red sin datos queda con null, no con 0', () => {
    const report = buildNetworkReport('tiktok', false, null, null, docs);
    expect(report).toMatchObject({ followers: null, impressions: null, followersChange: null });
  });
});

/** Firestore mínimo en memoria: solo lo que usa SocialService. */
function fakeDb() {
  const data = new Map<string, Record<string, unknown>>();
  const key = (collection: string, id: string) => `${collection}/${id}`;
  const ref = (collection: string, id: string) => ({
    id,
    _key: key(collection, id),
    set: (value: Record<string, unknown>, options?: { merge?: boolean }) => {
      const current = options?.merge ? (data.get(key(collection, id)) ?? {}) : {};
      const next: Record<string, unknown> = { ...current };
      for (const [field, item] of Object.entries(value)) {
        next[field] =
          options?.merge && item && typeof item === 'object' && typeof current[field] === 'object'
            ? { ...(current[field] as Record<string, unknown>), ...item }
            : item;
      }
      data.set(key(collection, id), next);
      return Promise.resolve();
    },
  });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(name, id) }),
    getAll: (...refs: { _key: string }[]) =>
      Promise.resolve(
        refs.map((r) => ({ exists: data.has(r._key), data: () => data.get(r._key) })),
      ),
  };
  return { db: db as unknown as Firestore, data };
}

describe('SocialService', () => {
  const ok: SocialProvider = {
    network: 'pinterest',
    read: () =>
      Promise.resolve({
        '2026-11-20': { impressions: 7, clicks: null },
        '2026-11-21': { followers: 5 },
      }),
  };
  const broken: SocialProvider = {
    network: 'instagram',
    read: () => Promise.reject(new SocialError('Instagram: token vencido.')),
  };
  const now = () => new Date('2026-11-21T10:00:00Z');

  it('guarda lo que lee, una red rota no frena a las otras y el error queda a la vista', async () => {
    const { db, data } = fakeDb();
    const service = new SocialService(db, [ok, broken], now);
    const results = await service.sync(3);
    expect(results).toEqual([
      { network: 'pinterest', status: 'ok', message: null },
      { network: 'instagram', status: 'error', message: 'Instagram: token vencido.' },
      { network: 'tiktok', status: 'not_connected', message: null },
    ]);
    expect(data.get('socialDaily/2026-11-20')).toEqual({
      day: '2026-11-20',
      pinterest: { impressions: 7 },
    });
    const report = await service.report(7);
    const byNetwork = Object.fromEntries(report.networks.map((n) => [n.network, n]));
    expect(byNetwork.pinterest).toMatchObject({ connected: true, followers: 5, impressions: 7 });
    expect(byNetwork.instagram).toMatchObject({
      connected: true,
      error: 'Instagram: token vencido.',
    });
    expect(byNetwork.tiktok).toMatchObject({ connected: false, followers: null });
  });
});
