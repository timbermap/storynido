import type { apiRoutes } from '@storynido/shared';
import type { z } from 'zod';

import { COUNTRY_COOKIE } from './country';
import { api } from './api';

/**
 * Panel de visitas propio (DECISIONS 301). Cuenta vistas de páginas públicas sin cookies,
 * sin identificadores y sin la dirección completa: solo ruta, idioma, país del sitio, red de
 * origen y campaña (UTM). Los pasos del embudo (empezó, muestra, pago, compra) salen solo con
 * consentimiento de analítica, porque usan el origen guardado en este navegador.
 */
const CLICK_ID_NETWORK = {
  fbclid: 'facebook',
  ttclid: 'tiktok',
  epik: 'pinterest',
  gclid: 'google',
} as const;
export const ATTRIBUTION_KEY = 'sn_attr';
const ATTRIBUTION_TTL_MS = 30 * 24 * 3600 * 1000;

export interface EntryInfo {
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** Cuál identificador de clic traía el enlace; el valor no se guarda ni se envía. */
  clickId: 'fbclid' | 'ttclid' | 'epik' | 'gclid' | null;
}

/** De dónde llegó esta visita: dominio de la página de origen (si no es el propio sitio) y UTM. */
export function readEntry(search: string, referrer: string, ownHost: string): EntryInfo {
  const params = new URLSearchParams(search);
  const take = (key: string) => {
    const value = params.get(key)?.slice(0, 80);
    return value?.length ? value : null;
  };
  let host: string | null = null;
  try {
    host = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : null;
  } catch {
    host = null;
  }
  if (host && host === ownHost.replace(/^www\./, '')) host = null;
  return {
    referrer: host,
    utmSource: take('utm_source'),
    utmMedium: take('utm_medium'),
    utmCampaign: take('utm_campaign'),
    utmContent: take('utm_content'),
    utmTerm: take('utm_term'),
    clickId:
      (['fbclid', 'ttclid', 'epik', 'gclid'] as const).find((key) => params.has(key)) ?? null,
  };
}

export function hasOrigin(entry: EntryInfo): boolean {
  return (
    entry.referrer !== null ||
    entry.utmSource !== null ||
    entry.utmCampaign !== null ||
    entry.clickId !== null
  );
}

export interface Attribution {
  source: string;
  campaign: string | null;
}

/** Origen para el embudo: «instagram» o «ref:dominio»; la campaña la arma el servidor igual. */
export function attributionFor(entry: EntryInfo): Attribution {
  const fromClickId = entry.clickId ? CLICK_ID_NETWORK[entry.clickId] : null;
  const source = (
    entry.utmSource ??
    fromClickId ??
    (entry.referrer ? `ref:${entry.referrer}` : 'direct')
  )
    .toLowerCase()
    .slice(0, 60);
  const campaign = entry.utmCampaign
    ? `${source}/${(entry.utmMedium ?? '-').toLowerCase()}/${entry.utmCampaign.toLowerCase()}`
    : null;
  return { source, campaign };
}

export function saveAttribution(entry: EntryInfo): void {
  if (!hasOrigin(entry)) return;
  try {
    window.localStorage.setItem(
      ATTRIBUTION_KEY,
      JSON.stringify({ ...attributionFor(entry), at: Date.now() }),
    );
  } catch {
    // Sin storage no hay origen para el embudo: se cuenta como «sin origen».
  }
}

export function loadAttribution(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { source?: string; campaign?: string | null; at?: number };
    if (!saved.source || !saved.at || Date.now() - saved.at > ATTRIBUTION_TTL_MS) return null;
    return { source: saved.source, campaign: saved.campaign ?? null };
  } catch {
    return null;
  }
}

/** Respeta «No rastrear» y Global Privacy Control. */
export function trackingOptedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

function siteCountry(): string | null {
  const match = new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([A-Za-z]{2})`).exec(document.cookie);
  return match?.[1]?.toUpperCase() ?? null;
}

const localeOf = (pathname: string): 'es' | 'en' | 'pt' => {
  const segment = pathname.split('/')[1];
  return segment === 'en' || segment === 'pt' ? segment : 'es';
};

type Hit = z.input<(typeof apiRoutes)['trafficHit']['body']>;

function send(body: Partial<Hit> & { path: string; locale: 'es' | 'en' | 'pt' }) {
  if (trackingOptedOut()) return;
  void api('trafficHit', { body }).catch(() => undefined);
}

/** Una vista de página pública (sin consentimiento: es solo un contador). */
export function sendView(pathname: string, entry: EntryInfo | null) {
  send({
    path: pathname,
    locale: localeOf(pathname),
    entry: entry !== null,
    country: siteCountry(),
    ...(entry ?? {}),
  });
}

/** Un paso del embudo, con el origen guardado en este navegador (solo con consentimiento). */
export function sendFunnelEvent(
  event: 'create_started' | 'preview_created' | 'begin_checkout' | 'purchase',
  pathname: string,
) {
  const attribution = loadAttribution();
  send({
    path: pathname,
    locale: localeOf(pathname),
    event,
    country: siteCountry(),
    attrSource: attribution?.source ?? null,
    attrCampaign: attribution?.campaign ?? null,
  });
}
