import type { ApiEnv } from '../config';

import {
  instagramProvider,
  pinterestProvider,
  tiktokProvider,
  type SocialProvider,
  type TokenStore,
} from './providers';

/** Las redes con credenciales cargadas; las demás quedan «sin conectar» en el panel. */
export function socialProvidersFromEnv(env: ApiEnv, tokens: TokenStore): SocialProvider[] {
  const providers: SocialProvider[] = [];
  const canRefresh =
    env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET && env.PINTEREST_REFRESH_TOKEN;
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
                  refreshToken: env.PINTEREST_REFRESH_TOKEN ?? '',
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
  }
  if (env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REFRESH_TOKEN) {
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
