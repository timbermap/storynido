/**
 * Clasificación de las visitas para el panel de tráfico. Todo es texto corto y sin datos
 * personales: la red de origen, el dispositivo y claves normalizadas para usar como contador.
 */

const NETWORKS: readonly { name: string; utm: readonly string[]; hosts: readonly string[] }[] = [
  { name: 'whatsapp', utm: ['whatsapp', 'wa', 'wapp'], hosts: ['whatsapp.com', 'wa.me'] },
  {
    name: 'instagram',
    utm: ['instagram', 'ig', 'insta'],
    hosts: ['instagram.com', 'l.instagram.com'],
  },
  {
    name: 'facebook',
    utm: ['facebook', 'fb', 'meta'],
    hosts: ['facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com', 'fb.com'],
  },
  { name: 'tiktok', utm: ['tiktok', 'tt'], hosts: ['tiktok.com', 'vm.tiktok.com'] },
  { name: 'youtube', utm: ['youtube', 'yt'], hosts: ['youtube.com', 'm.youtube.com', 'youtu.be'] },
  { name: 'x', utm: ['x', 'twitter'], hosts: ['t.co', 'x.com', 'twitter.com'] },
  { name: 'pinterest', utm: ['pinterest', 'pin'], hosts: ['pinterest.com', 'pin.it'] },
  { name: 'linkedin', utm: ['linkedin', 'li'], hosts: ['linkedin.com', 'lnkd.in'] },
  { name: 'telegram', utm: ['telegram', 'tg'], hosts: ['t.me', 'telegram.org'] },
  { name: 'reddit', utm: ['reddit'], hosts: ['reddit.com', 'out.reddit.com'] },
  { name: 'google', utm: ['google'], hosts: ['google.com'] },
  { name: 'bing', utm: ['bing'], hosts: ['bing.com'] },
  { name: 'duckduckgo', utm: ['duckduckgo'], hosts: ['duckduckgo.com'] },
  { name: 'email', utm: ['email', 'mail', 'newsletter'], hosts: ['mail.google.com'] },
];

/** Minúsculas y solo letras, números, guion y guion bajo; lo demás se vuelve guion. */
export function cleanLabel(value: string | null | undefined, max = 40): string | null {
  const cleaned = (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return cleaned.length ? cleaned : null;
}

function hostOf(value: string | null | undefined): string | null {
  const host = (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .split(/[/?#:]/)[0]
    ?.replace(/^www\./, '');
  return host && /^[a-z0-9.-]+$/.test(host) ? host : null;
}

function networkForHost(host: string): string | null {
  for (const network of NETWORKS) {
    if (network.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return network.name;
  }
  // Buscadores en otros países (google.com.ar, bing.com…).
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google';
  return null;
}

/** Red de origen: el utm_source manda; si no, el dominio de la página de origen; si no, directo. */
export function classifySource(utmSource: string | null, referrer: string | null): string {
  const utm = cleanLabel(utmSource, 30);
  if (utm) {
    const known = NETWORKS.find((network) => network.utm.includes(utm));
    return known?.name ?? utm;
  }
  const host = hostOf(referrer);
  if (!host) return 'direct';
  return networkForHost(host) ?? `ref:${host.slice(0, 40)}`;
}

/** Clave de campaña: «red/medio/campaña»; vacía si la visita no trae campaña. */
export function campaignKey(
  source: string,
  medium: string | null,
  campaign: string | null,
): string | null {
  const name = cleanLabel(campaign, 40);
  if (!name) return null;
  return `${source}/${cleanLabel(medium, 20) ?? '-'}/${name}`;
}

export type Device = 'mobile' | 'tablet' | 'desktop';

const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|monitor|curl|wget/i;

/** Dispositivo por el navegador; null si parece un robot (no se cuenta). El texto no se guarda. */
export function classifyDevice(userAgent: string | undefined): Device | null {
  const ua = userAgent ?? '';
  if (!ua || BOT.test(ua)) return null;
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Ruta pública sin idioma ni parámetros: «/es/como-funciona» → «/como-funciona». */
export function cleanPath(path: string): string {
  const stripped =
    path.toLowerCase().split(/[?#]/)[0] ??
    ''.replace(/^\/(es|en|pt)(?=\/|$)/, '').replace(/\/+$/, '');
  const safe = stripped.replace(/[^a-z0-9/_-]+/g, '-').slice(0, 80);
  return safe.startsWith('/') ? safe : `/${safe}`;
}

export function cleanCountry(value: string | null | undefined): string {
  const upper = (value ?? '').toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : 'ZZ';
}

/** Las claves de un mapa de Firestore: sin puntos ni barras. */
export const encodeKey = (key: string) => key.replace(/\./g, '·').replace(/\//g, '~');
export const decodeKey = (key: string) => key.replace(/·/g, '.').replace(/~/g, '/');
