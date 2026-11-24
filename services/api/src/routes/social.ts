import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { AppError } from '../errors';
import { addRoute } from '../plugins/route';
import { SocialError } from '../social/providers';
import type { SocialService } from '../social/service';

type SyncBody = z.output<(typeof apiRoutes)['adminSocialSync']['body']>;

/**
 * Marketing → Redes (DECISIONS 309): lee Pinterest, Instagram y TikTok por sus APIs y muestra
 * seguidores, alcance, impresiones y clics. Solo lectura sobre las redes.
 */
const toAppError = (error: unknown) =>
  error instanceof SocialError ? new AppError(400, 'validation_failed', error.message) : error;
function asAppError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    throw toAppError(error);
  }
}

export function registerSocialRoutes(app: FastifyInstance, social: SocialService): void {
  addRoute(app, apiRoutes.adminSocial, {}, async (request) => {
    const { days } = request.query as { days: number };
    return social.report(days);
  });

  addRoute(app, apiRoutes.adminSocialTiktokAuthUrl, {}, (request) => {
    const { redirectUri, state, videos } = request.query as {
      redirectUri: string;
      state: string;
      videos: '1' | '0';
    };
    return Promise.resolve({
      url: asAppError(() => social.tiktokAuthorizeUrl(redirectUri, state, videos === '1')),
    });
  });

  addRoute(app, apiRoutes.adminSocialTiktokConnect, {}, async (request) => {
    const { code, redirectUri } = request.body as { code: string; redirectUri: string };
    try {
      return await social.connectTikTok(code, redirectUri);
    } catch (error) {
      throw toAppError(error);
    }
  });

  addRoute(app, apiRoutes.adminSocialTiktokDisconnect, {}, async () => {
    await social.disconnectTikTok();
    return { ok: true as const };
  });

  addRoute(app, apiRoutes.adminSocialSync, {}, async (request) => {
    const { days } = request.body as SyncBody;
    return { results: await social.sync(days) };
  });
}
