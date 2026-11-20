import { COLLECTIONS, apiRoutes } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { addRoute } from '../plugins/route';
import {
  campaignKey,
  classifyDevice,
  classifySource,
  cleanCountry,
  cleanLabel,
  cleanPath,
} from '../traffic/classify';
import { buildReport, recordHit, type TrafficDay } from '../traffic/service';

type HitBody = z.output<(typeof apiRoutes)['trafficHit']['body']>;

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Panel de visitas (DECISIONS 300): contadores diarios propios, sin cookies, sin IP y sin
 * identificadores. El navegador no se guarda: solo se usa para saber si es celular, tableta o
 * computadora, y para no contar robots.
 */
export function registerTrafficRoutes(app: FastifyInstance): void {
  const { db } = app.deps;

  addRoute(app, apiRoutes.trafficHit, {}, async (request) => {
    const body = request.body as HitBody;
    const device = classifyDevice(request.headers['user-agent']);
    if (!device) return { ok: true as const };
    const source = classifySource(body.utmSource, body.referrer);
    await recordHit(db, {
      day: dayOf(new Date()),
      path: cleanPath(body.path),
      locale: body.locale,
      entry: body.entry,
      source,
      campaign: body.entry ? campaignKey(source, body.utmMedium, body.utmCampaign) : null,
      country: cleanCountry(body.country),
      device,
      event: body.event,
      attrSource: cleanLabel(body.attrSource, 50),
      attrCampaign: body.attrCampaign
        ? body.attrCampaign
            .toLowerCase()
            .replace(/[^a-z0-9/_.-]+/g, '-')
            .slice(0, 100)
        : null,
    });
    return { ok: true as const };
  });

  addRoute(app, apiRoutes.adminTraffic, {}, async (request) => {
    const { days } = request.query as { days: number };
    const now = new Date();
    const refs = Array.from({ length: days }, (_, index) =>
      db
        .collection(COLLECTIONS.trafficDaily)
        .doc(dayOf(new Date(now.getTime() - index * 86_400_000))),
    );
    const snaps = await db.getAll(...refs);
    const docs = snaps.filter((snap) => snap.exists).map((snap) => snap.data() as TrafficDay);
    return buildReport(docs, days, dayOf(new Date(now.getTime() - (days - 1) * 86_400_000)));
  });
}
