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
  /** TikTok: «me gusta» acumulados de la cuenta (nivel, no un número diario). */
  likes: number | null;
}

/** Un video publicado, con sus números (hoy solo TikTok). */
export interface SocialVideo {
  id: string;
  title: string;
  createdAt: string | null;
  url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

/** Datos extra que una lectura puede dejar además de los números por día. */
export interface ReadExtras {
  videos?: SocialVideo[];
}

/** Lo que devuelve una lectura: los números por día (AAAA-MM-DD, UTC). */
export type SocialReading = Record<string, Partial<SocialSnapshot>>;

export interface SocialProvider {
  network: SocialNetwork;
  /** `days`: cuántos días hacia atrás leer (las redes que informan por día). */
  read(days: number, today: string, extras?: ReadExtras): Promise<SocialReading>;
  /** Falso si falta autorizar la cuenta (TikTok antes del primer «Conectar»). Sin definir = lista. */
  hasCredentials?(): Promise<boolean>;
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

// --- TikTok (Login Kit + Display API: seguidores, me gusta y vistas por video) -----------------

export interface TikTokOptions {
  clientKey: string;
  clientSecret: string;
  /** Opcional: el token de renovación normal se guarda al autorizar desde el admin. */
  refreshToken?: string | undefined;
}

/** Permisos de solo lectura que pide el botón «Conectar TikTok». */
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.stats', 'video.list'] as const;
const TIKTOK_API = 'https://open.tiktokapis.com/v2';

/** Pantalla de TikTok donde Sebas autoriza la cuenta (Login Kit, flujo web). */
export function tiktokAuthorizeUrl(clientKey: string, redirectUri: string, state: string): string {
  const query = new URLSearchParams({
    client_key: clientKey,
    scope: TIKTOK_SCOPES.join(','),
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${query.toString()}`;
}

export interface TikTokAuth {
  authorizeUrl(redirectUri: string, state: string): string;
  /** Cambia el código de autorización por los tokens y guarda el de renovación. */
  connect(code: string, redirectUri: string): Promise<{ displayName: string | null }>;
}

export function tiktokAuth(
  options: Pick<TikTokOptions, 'clientKey' | 'clientSecret'>,
  tokens: TokenStore,
  fetcher: Fetcher = fetch,
): TikTokAuth {
  return {
    authorizeUrl: (redirectUri, state) => tiktokAuthorizeUrl(options.clientKey, redirectUri, state),
    async connect(code, redirectUri) {
      const body = await json(
        fetcher,
        `${TIKTOK_API}/oauth/token/`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: options.clientKey,
            client_secret: options.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        },
        'TikTok (autorizar)',
      );
      if (typeof body.refresh_token !== 'string' || typeof body.access_token !== 'string') {
        const reason =
          typeof body.error_description === 'string'
            ? ` (${body.error_description.slice(0, 120)})`
            : '';
        throw new SocialError(`TikTok: no devolvió los tokens${reason}. Probá conectar de nuevo.`);
      }
      await tokens.set('tiktok', body.refresh_token);
      let displayName: string | null = null;
      try {
        const info = await json(
          fetcher,
          `${TIKTOK_API}/user/info/?fields=display_name`,
          { headers: { authorization: `Bearer ${body.access_token}` } },
          'TikTok',
        );
        const user = (info.data as { user?: { display_name?: unknown } } | undefined)?.user;
        displayName = typeof user?.display_name === 'string' ? user.display_name : null;
      } catch {
        // El nombre es solo para mostrar; la conexión ya quedó guardada.
      }
      return { displayName };
    },
  };
}

export function tiktokProvider(
  options: TikTokOptions,
  tokens: TokenStore,
  fetcher: Fetcher = fetch,
): SocialProvider {
  const base = TIKTOK_API;
  const currentToken = async () => (await tokens.get('tiktok')) ?? options.refreshToken ?? null;
  return {
    network: 'tiktok',
    async hasCredentials() {
      return (await currentToken()) !== null;
    },
    async read(_days, today, extras) {
      // El token de acceso dura 24 h: se renueva en cada lectura y se guarda el de renovación.
      const current = await currentToken();
      if (!current) {
        throw new SocialError('TikTok: falta autorizar la cuenta. Tocá «Conectar TikTok».');
      }
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
        likes: num(user.likes_count),
        posts: num(user.video_count),
      };
      // Las vistas por video necesitan el permiso video.list; si falta, se muestran solo los seguidores.
      try {
        const list = await json(
          fetcher,
          `${base}/video/list/?fields=id,title,create_time,share_url,view_count,like_count,comment_count,share_count`,
          { method: 'POST', headers, body: JSON.stringify({ max_count: 20 }) },
          'TikTok (videos)',
        );
        const raw = (list.data as { videos?: Record<string, unknown>[] } | undefined)?.videos;
        if (Array.isArray(raw)) {
          snapshot.videoViews = raw.reduce((sum, video) => sum + (num(video.view_count) ?? 0), 0);
          if (extras) {
            extras.videos = raw.map((video, index) => ({
              id: typeof video.id === 'string' ? video.id : String(index),
              title: typeof video.title === 'string' ? video.title.slice(0, 120) : '',
              createdAt:
                typeof video.create_time === 'number'
                  ? new Date(video.create_time * 1000).toISOString()
                  : null,
              url: typeof video.share_url === 'string' ? video.share_url : null,
              views: num(video.view_count),
              likes: num(video.like_count),
              comments: num(video.comment_count),
              shares: num(video.share_count),
            }));
          }
        }
      } catch {
        // Sin el permiso de videos, solo seguidores.
      }
      return { [today]: snapshot };
    },
  };
}
