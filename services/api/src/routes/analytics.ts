import { apiRoutes } from '@storynido/shared';
import type { FastifyInstance } from 'fastify';

import type { AnalyticsService } from '../analytics/service';
import { addRoute } from '../plugins/route';

/** Marketing → Analytics: lee Google Analytics 4 (solo lectura) para mostrarlo junto al panel propio. */
export function registerAnalyticsRoutes(app: FastifyInstance, analytics: AnalyticsService): void {
  addRoute(app, apiRoutes.adminAnalytics, {}, async (request) => {
    const { days } = request.query as { days: number };
    return analytics.report(days);
  });
}
