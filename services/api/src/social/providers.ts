import type { SocialNetwork } from '@storynido/shared';

/** Números de una red en un día; null = la red no informó ese dato. */
export interface SocialSnapshot {
  followers: number | null;
  posts: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  profileVisits: number | null;
  /** TikTok: vistas acumuladas de los últimos videos (nivel, no un número diario). */
  videoViews: number | null;
}

/** Lo que devuelve una lectura: los números por día (AAAA-MM-DD, UTC). */
export type SocialReading = Record<string, Partial<SocialSnapshot>>;

export interface SocialProvider {
  network: SocialNetwork;
  /** `days`: cuántos días hacia atrás leer (las redes que informan por día). */
  read(days: number, today: string): Promise<SocialReading>;
}

/** Donde se guarda el token de renovación vigente de las redes que lo rotan (no va en el código). */
export interface TokenStore {
  get(network: SocialNetwork): Promise<string | null>;
  set(network: SocialNetwork, refreshToken: string): Promise<void>;
}

export type Fetcher = typeof fetch;

const TIMEOUT_MS = 15_000;
const DAY_MS = 24 * 3600 * 1000;

const addDays = (day: string, delta: number) =>
  new Date(new Date(`${day}T00:00:00.000Z`).getTime() + delta * DAY_MS).toISOString().slice(0, 10);

/** Error de una red con un mensaje que el admin puede leer y actuar. */
export class SocialError extends Error {}

async function json(fetcher: Fetcher, url: string, init: RequestInit, label: string) {
  let response: Response;
  try {
    response = await fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new SocialError(`${label}: no respondió.`);
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = errorDetail(body);
    const hint =
      response.status === 401 || response.status === 403
        ? ' Revisá el token: puede estar vencido o sin permiso.'
        : '';
    throw new SocialError(
      `${label}: error ${String(response.status)}${detail ? ` (${detail})` : ''}.${hint}`,
    );
  }
  return body as Record<string, unknown>;
}

/** El mensaje corto que traen los errores de las tres APIs, sin volcar la respuesta entera. */
function errorDetail(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;
  const nested = record.error;
  const pick =
    (typeof nested === 'object' && nested ? (nested as Record<string, unknown>).message : null) ??
    record.message ??
    (typeof nested === 'string' ? nested : null);
  return typeof pick === 'string' ? pick.slice(0, 120) : '';
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

// --- Pinterest (API v5) ------------------------------------------------------

export interface PinterestOptions {
  accessToken?: string;
  /** Con estos tres, el token de acceso (dura 30 días) se renueva solo en cada lectura. */
  refresh?: { appId: string; appSecret: string; refreshToken: string };
}

export function pinterestProvider(
  options: PinterestOptions,
  tokens: TokenStore,
  fetcher: Fetcher = fetch,
): SocialProvider {
  const base = 'https://api.pinterest.com/v5';
  async function accessToken(): Promise<string> {
    const refresh = options.refresh;
    if (!refresh) {
      if (!options.accessToken) throw new SocialError('Pinterest: falta el token.');
      return options.accessToken;
    }
    const current = (await tokens.get('pinterest')) ?? refresh.refreshToken;
    const basic = Buffer.from(`${refresh.appId}:${refresh.appSecret}`).toString('base64');
    const body = await json(
      fetcher,
      `${base}/oauth/token`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current }),
      },
      'Pinterest (renovar token)',
    );
    if (typeof body.access_token !== 'string') {
      throw new SocialError('Pinterest: no devolvió un token nuevo.');
    }
    if (typeof body.refresh_token === 'string' && body.refresh_token !== current) {
      await tokens.set('pinterest', body.refresh_token);
    }
    return body.access_token;
  }
  return {
    network: 'pinterest',
    async read(days, today) {
      const token = await accessToken();
      const headers = { authorization: `Bearer ${token}` };
      const account = await json(fetcher, `${base}/user_account`, { headers }, 'Pinterest');
      const reading: SocialReading = {
        [today]: { followers: num(account.follower_count), posts: num(account.pin_count) },
      };
      // Pinterest tarda hasta 48 h en cerrar cada día: se leen solo los marcados READY.
      const query = new URLSearchParams({
        start_date: addDays(today, -days),
        end_date: addDays(today, -1),
        metric_types: 'IMPRESSION,OUTBOUND_CLICK,ENGAGEMENT',
        app_types: 'ALL',
        split_field: 'NO_SPLIT',
      });
      const analytics = await json(
        fetcher,
        `${base}/user_account/analytics?${query.toString()}`,
        { headers },
        'Pinterest (estadísticas)',
      );
      const all = analytics.all as { daily_metrics?: unknown } | undefined;
      const daily = Array.isArray(all?.daily_metrics) ? all.daily_metrics : [];
      for (const item of daily) {
        const row = item as {
          date?: string;
          data_status?: string;
          metrics?: Record<string, unknown>;
        };
        if (!row.date || row.data_status !== 'READY') continue;
        reading[row.date] = {
          ...reading[row.date],
          impressions: num(row.metrics?.IMPRESSION),
          clicks: num(row.metrics?.OUTBOUND_CLICK),
          profileVisits: null,
        };
      }
      return reading;
    },
  };
}

// --- Instagram (Graph API, cuenta profesional vinculada a una página de Facebook) ---------

export interface InstagramOptions {
  accessToken: string;
  /** ID de la cuenta profesional de Instagram (no el nombre de usuario). */
  userId: string;
}

const GRAPH = 'https://graph.facebook.com/v21.0';

export function instagramProvider(
  options: InstagramOptions,
  fetcher: Fetcher = fetch,
): SocialProvider {
  const { accessToken, userId } = options;
  return {
    network: 'instagram',
    async read(days, today) {
      const profile = await json(
        fetcher,
        `${GRAPH}/${userId}?${new URLSearchParams({ fields: 'followers_count,media_count', access_token: accessToken }).toString()}`,
        {},
        'Instagram',
      );
      const reading: SocialReading = {
        [today]: { followers: num(profile.followers_count), posts: num(profile.media_count) },
      };
      // Un día cerrado por vez; cada número va aparte para que uno sin permiso no tire el resto.
      const metrics = {
        views: 'impressions',
        reach: 'reach',
        website_clicks: 'clicks',
        profile_views: 'profileVisits',
      } as const;
      let failure: SocialError | null = null;
      let loaded = 0;
      for (let back = 1; back <= days; back += 1) {
        const day = addDays(today, -back);
        const since = Math.floor(new Date(`${day}T00:00:00.000Z`).getTime() / 1000);
        for (const [metric, field] of Object.entries(metrics) as [
          keyof typeof metrics,
          (typeof metrics)[keyof typeof metrics],
        ][]) {
          try {
            const query = new URLSearchParams({
              metric,
              period: 'day',
              metric_type: 'total_value',
              since: String(since),
              until: String(since + 86_400),
              access_token: accessToken,
            });
            const body = await json(
              fetcher,
              `${GRAPH}/${userId}/insights?${query.toString()}`,
              {},
              `Instagram (${metric})`,
            );
            const first = Array.isArray(body.data)
              ? (body.data[0] as Record<string, unknown>)
              : null;
            const value = num((first?.total_value as { value?: unknown } | undefined)?.value);
            if (value !== null) {
              reading[day] = { ...reading[day], [field]: value };
              loaded += 1;
            }
          } catch (error) {
            if (error instanceof SocialError) failure = error;
          }
        }
      }
      // Si ningún número de los días llegó y hubo error, que se vea (token o permisos).
      if (loaded === 0 && failure && days > 0) throw failure;
      return reading;
    },
  };
}

// --- TikTok (Display API: seguidores y vistas de los últimos videos) ---------------------------

export interface TikTokOptions {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
}

export function tiktokProvider(
  options: TikTokOptions,
  tokens: TokenStore,
  fetcher: Fetcher = fetch,
): SocialProvider {
  const base = 'https://open.tiktokapis.com/v2';
  return {
    network: 'tiktok',
    async read(_days, today) {
      // El token de acceso dura 24 h: se renueva en cada lectura y se guarda el de renovación.
      const current = (await tokens.get('tiktok')) ?? options.refreshToken;
      const refreshed = await json(
        fetcher,
        `${base}/oauth/token/`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: options.clientKey,
            client_secret: options.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: current,
          }),
        },
        'TikTok (renovar token)',
      );
      if (typeof refreshed.access_token !== 'string') {
        throw new SocialError(
          'TikTok: no devolvió un token nuevo. Puede que el de renovación haya vencido.',
        );
      }
      if (typeof refreshed.refresh_token === 'string' && refreshed.refresh_token !== current) {
        await tokens.set('tiktok', refreshed.refresh_token);
      }
      const headers = {
        authorization: `Bearer ${refreshed.access_token}`,
        'content-type': 'application/json',
      };
      const info = await json(
        fetcher,
        `${base}/user/info/?fields=follower_count,likes_count,video_count`,
        { headers },
        'TikTok',
      );
      const user = (info.data as { user?: Record<string, unknown> } | undefined)?.user ?? {};
      const snapshot: Partial<SocialSnapshot> = {
        followers: num(user.follower_count),
        posts: num(user.video_count),
      };
      // Las vistas por video necesitan el permiso video.list; si falta, se muestran solo los seguidores.
      try {
        const list = await json(
          fetcher,
          `${base}/video/list/?fields=id,view_count`,
          { method: 'POST', headers, body: JSON.stringify({ max_count: 20 }) },
          'TikTok (videos)',
        );
        const videos = (list.data as { videos?: { view_count?: unknown }[] } | undefined)?.videos;
        if (Array.isArray(videos)) {
          snapshot.videoViews = videos.reduce(
            (sum, video) => sum + (num(video.view_count) ?? 0),
            0,
          );
        }
      } catch {
        // Sin el permiso de videos, solo seguidores.
      }
      return { [today]: snapshot };
    },
  };
}
