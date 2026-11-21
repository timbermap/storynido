import { buildReport, type TrafficDay } from './service';
import { encodeKey } from './classify';

/** Dos días de ejemplo para probar la suma del informe. */
export function buildReportForTest() {
  const docs: TrafficDay[] = [
    {
      day: '2026-11-19',
      views: 4,
      entries: 2,
      pages: { [encodeKey('/')]: 3, [encodeKey('/como-funciona')]: 1 },
      landings: { [encodeKey('/')]: 2 },
      sources: { instagram: 2 },
      campaigns: { [encodeKey('instagram/social/verano')]: 2 },
      contents: { [encodeKey('instagram/reel-1')]: 2 },
      terms: { [encodeKey('instagram/cumple')]: 1 },
      countries: { AR: 4 },
      devices: { mobile: 4 },
      locales: { es: 4 },
      funnelSource: { instagram__create_started: 2, instagram__purchase: 1 },
      funnelCampaign: { [encodeKey('instagram/social/verano__create_started')]: 2 },
    },
    {
      day: '2026-11-20',
      views: 3,
      entries: 1,
      pages: { [encodeKey('/')]: 2, [encodeKey('/crear')]: 1 },
      landings: { [encodeKey('/')]: 1 },
      sources: { direct: 1 },
      countries: { AR: 2, MX: 1 },
      devices: { desktop: 3 },
      locales: { es: 3 },
    },
  ];
  return buildReport(docs, 30, '2026-10-22');
}
