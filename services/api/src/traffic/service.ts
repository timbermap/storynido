import { COLLECTIONS, TRAFFIC_EVENTS, type TrafficEvent } from '@storynido/shared';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { decodeKey, encodeKey } from './classify';

export interface HitRecord {
  day: string;
  path: string;
  locale: string;
  entry: boolean;
  source: string;
  campaign: string | null;
  /** «red/pieza» (utm_content) y «red/palabra» (utm_term) de la entrada. */
  content: string | null;
  term: string | null;
  country: string;
  device: string;
  event: TrafficEvent | null;
  /** Origen guardado en el navegador para un paso del embudo. */
  attrSource: string | null;
  attrCampaign: string | null;
}

const inc = () => FieldValue.increment(1);

/**
 * Contadores diarios en `trafficDaily/{día}`: un mapa por dimensión, sin visitante ni IP.
 * Las vistas y entradas cuentan siempre; los pasos del embudo traen el origen guardado en
 * el navegador (solo con consentimiento de analítica).
 */
export async function recordHit(db: Firestore, hit: HitRecord): Promise<void> {
  const ref = db.collection(COLLECTIONS.trafficDaily).doc(hit.day);
  if (hit.event) {
    const source = hit.attrSource ?? 'unknown';
    const update: Record<string, unknown> = {
      funnelSource: { [encodeKey(`${source}__${hit.event}`)]: inc() },
    };
    if (hit.attrCampaign) {
      update.funnelCampaign = { [encodeKey(`${hit.attrCampaign}__${hit.event}`)]: inc() };
    }
    await ref.set({ day: hit.day, ...update }, { merge: true });
    return;
  }
  const update: Record<string, unknown> = {
    day: hit.day,
    views: inc(),
    pages: { [encodeKey(hit.path)]: inc() },
    countries: { [hit.country]: inc() },
    devices: { [hit.device]: inc() },
    locales: { [hit.locale]: inc() },
  };
  if (hit.entry) {
    update.entries = inc();
    update.sources = { [encodeKey(hit.source)]: inc() };
    // Páginas de aterrizaje: dónde empieza cada visita.
    update.landings = { [encodeKey(hit.path)]: inc() };
    if (hit.campaign) update.campaigns = { [encodeKey(hit.campaign)]: inc() };
    if (hit.content) update.contents = { [encodeKey(hit.content)]: inc() };
    if (hit.term) update.terms = { [encodeKey(hit.term)]: inc() };
  }
  await ref.set(update, { merge: true });
}

type CountMap = Record<string, number>;
export interface TrafficDay {
  day: string;
  views?: number;
  entries?: number;
  pages?: CountMap;
  landings?: CountMap;
  sources?: CountMap;
  campaigns?: CountMap;
  contents?: CountMap;
  terms?: CountMap;
  countries?: CountMap;
  devices?: CountMap;
  locales?: CountMap;
  funnelSource?: CountMap;
  funnelCampaign?: CountMap;
}

function merge(target: Map<string, number>, source: CountMap | undefined) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (typeof value === 'number') target.set(key, (target.get(key) ?? 0) + value);
  }
}

const top = (map: Map<string, number>, limit: number) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

/** Suma los días y arma lo que muestra el panel. */
export function buildReport(docs: TrafficDay[], days: number, since: string) {
  const pages = new Map<string, number>();
  const landings = new Map<string, number>();
  const sources = new Map<string, number>();
  const campaigns = new Map<string, number>();
  const contents = new Map<string, number>();
  const terms = new Map<string, number>();
  const countries = new Map<string, number>();
  const devices = new Map<string, number>();
  const locales = new Map<string, number>();
  const funnelSource = new Map<string, number>();
  const funnelCampaign = new Map<string, number>();
  let views = 0;
  let entries = 0;
  for (const doc of docs) {
    views += doc.views ?? 0;
    entries += doc.entries ?? 0;
    merge(pages, doc.pages);
    merge(landings, doc.landings);
    merge(sources, doc.sources);
    merge(campaigns, doc.campaigns);
    merge(contents, doc.contents);
    merge(terms, doc.terms);
    merge(countries, doc.countries);
    merge(devices, doc.devices);
    merge(locales, doc.locales);
    merge(funnelSource, doc.funnelSource);
    merge(funnelCampaign, doc.funnelCampaign);
  }
  const rows = (map: Map<string, number>, entryMap: Map<string, number> | null, limit: number) =>
    top(map, limit).map(([key, count]) => ({
      key: decodeKey(key),
      views: count,
      entries: entryMap?.get(key) ?? 0,
    }));
  const funnel = (counts: Map<string, number>, entryMap: Map<string, number>, limit: number) => {
    const keys = new Set<string>();
    for (const key of counts.keys()) keys.add(key.split('__')[0] ?? key);
    const out = [...keys].map((base) => {
      const row = {
        key: decodeKey(base),
        entries: entryMap.get(base) ?? 0,
        create_started: 0,
        preview_created: 0,
        begin_checkout: 0,
        purchase: 0,
      };
      for (const event of TRAFFIC_EVENTS) row[event] = counts.get(`${base}__${event}`) ?? 0;
      return row;
    });
    return out
      .sort((a, b) => b.create_started + b.entries - (a.create_started + a.entries))
      .slice(0, limit);
  };
  return {
    days,
    since,
    totals: {
      views,
      entries,
      campaignEntries: [...campaigns.values()].reduce((sum, n) => sum + n, 0),
    },
    daily: docs
      .map((doc) => ({ day: doc.day, views: doc.views ?? 0, entries: doc.entries ?? 0 }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    pages: rows(pages, landings, 25),
    sources: top(sources, 25).map(([key, count]) => ({
      key: decodeKey(key),
      views: count,
      entries: count,
    })),
    campaigns: top(campaigns, 25).map(([key, count]) => ({
      key: decodeKey(key),
      views: count,
      entries: count,
    })),
    contents: top(contents, 25).map(([key, count]) => ({
      key: decodeKey(key),
      views: count,
      entries: count,
    })),
    terms: top(terms, 25).map(([key, count]) => ({
      key: decodeKey(key),
      views: count,
      entries: count,
    })),
    countries: rows(countries, null, 25),
    devices: rows(devices, null, 5),
    locales: rows(locales, null, 5),
    funnelBySource: funnel(funnelSource, sources, 25),
    funnelByCampaign: funnel(funnelCampaign, campaigns, 25),
  };
}
