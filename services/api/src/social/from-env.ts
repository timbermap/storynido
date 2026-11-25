import type { ApiEnv } from '../config';

import {
  facebookProvider,
  instagramProvider,
  pinterestAuth,
  type PinterestAuth,
  pinterestProvider,
  tiktokAuth,
  tiktokProvider,
  type TikTokAuth,
  type SocialProvider,
  type TokenStore,
} from './providers';

/** Las redes con credenciales cargadas; las demás quedan «sin conectar» en el panel. */
export function socialProvidersFromEnv(env: ApiEnv, tokens: TokenStore): SocialProvider[] {
  const providers: SocialProvider[] = [];
  // Con la app (id y secret) alcanza: el token de renovación se guarda al tocar «Conectar Pinterest».
  const canRefresh = env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET;
  if (canRefresh || env.PINTEREST_ACCESS_TOKEN) {
    providers.push(
      pinterestProvider(
        {
          ...(env.PINTEREST_ACCESS_TOKEN ? { accessToken: env.PINTEREST_ACCESS_TOKEN } : {}),
          ...(canRefresh
            ? {
                refresh: {
                  appId: env.PINTEREST_APP_ID ?? '',
                  appSecret: env.PINTEREST_APP_SECRET ?? '',
                  refreshToken: env.PINTEREST_REFRESH_TOKEN,
                },
              }
            : {}),
        },
        tokens,
      ),
    );
  }
  if (env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID) {
    providers.push(
      instagramProvider({ accessToken: env.INSTAGRAM_ACCESS_TOKEN, userId: env.INSTAGRAM_USER_ID }),
    );
    // La página de Facebook se lee con el mismo token de Meta: no hace falta otro secreto.
    providers.push(
      facebookProvider({
        accessToken: env.INSTAGRAM_ACCESS_TOKEN,
        instagramUserId: env.INSTAGRAM_USER_ID,
      }),
    );
  }
  if (env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET) {
    providers.push(
      tiktokProvider(
        {
          clientKey: env.TIKTOK_CLIENT_KEY,
          clientSecret: env.TIKTOK_CLIENT_SECRET,
          refreshToken: env.TIKTOK_REFRESH_TOKEN,
        },
        tokens,
      ),
    );
  }
  return providers;
}

/** El «Conectar TikTok» del admin: solo existe si la app de TikTok tiene client key y secret. */
export function tiktokAuthFromEnv(env: ApiEnv, tokens: TokenStore): TikTokAuth | null {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) return null;
  return tiktokAuth(
    { clientKey: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET },
    tokens,
  );
}

/** El «Conectar Pinterest» del admin: solo existe si la app de Pinterest tiene id y secret. */
export function pinterestAuthFromEnv(env: ApiEnv, tokens: TokenStore): PinterestAuth | null {
  if (!env.PINTEREST_APP_ID || !env.PINTEREST_APP_SECRET) return null;
  return pinterestAuth(
    { appId: env.PINTEREST_APP_ID, appSecret: env.PINTEREST_APP_SECRET },
    tokens,
  );
}
