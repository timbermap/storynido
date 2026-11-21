import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { addRoute } from '../plugins/route';
import type { SocialService } from '../social/service';

type SyncBody = z.output<(typeof apiRoutes)['adminSocialSync']['body']>;

/**
 * Marketing → Redes (DECISIONS 309): lee Pinterest, Instagram y TikTok por sus APIs y muestra
 * seguidores, alcance, impresiones y clics. Solo lectura sobre las redes.
 */
export function registerSocialRoutes(app: FastifyInstance, social: SocialService): void {
  addRoute(app, apiRoutes.adminSocial, {}, async (request) => {
    const { days } = request.query as { days: number };
    return social.report(days);
  });

  addRoute(app, apiRoutes.adminSocialSync, {}, async (request) => {
    const { days } = request.body as SyncBody;
    return { results: await social.sync(days) };
  });
}
