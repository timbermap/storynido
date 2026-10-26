import 'server-only';

import {
  ApiError,
  createApiClient,
  type CountryCode,
  type Locale,
  type Offer,
} from '@storynido/shared';

/** URL de la API desde el servidor (puede ser interna); por defecto la pública. */
const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

/** Catálogo y contenido cambian poco: se cachean unos minutos en el servidor de Next. */
const CATALOG_REVALIDATE_SECONDS = 300;
const SITE_MODE_REVALIDATE_SECONDS = 15;

function client(revalidate: number) {
  return createApiClient({
    baseUrl: API_URL,
    fetch: (input, init) => fetch(input, { ...init, next: { revalidate, tags: ['catalog'] } }),
  });
}

const catalogApi = client(CATALOG_REVALIDATE_SECONDS);
const siteApi = client(SITE_MODE_REVALIDATE_SECONDS);

export async function getSiteMode() {
  try {
    return (await siteApi('siteConfig')).mode;
  } catch {
    // Si la API no responde, el sitio sigue mostrando el contenido público.
    return 'live' as const;
  }
}

export async function getStories(locale: Locale, age?: number) {
  return (await catalogApi('catalogStories', { query: { locale, age } })).stories;
}

export async function getStory(locale: Locale, slug: string) {
  try {
    return await catalogApi('catalogStory', { params: { slug }, query: { locale } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getActiveCountries() {
  try {
    return (await catalogApi('catalogCountries')).countries;
  } catch {
    return [];
  }
}

export async function getOffer(country: CountryCode, locale: Locale): Promise<Offer | null> {
  try {
    return await catalogApi('catalogOffer', { query: { country, locale } });
  } catch {
    return null;
  }
}

export async function getContent(
  key: 'terms' | 'privacy' | 'cookies' | 'refunds' | 'shipping' | 'faq',
  locale: Locale,
) {
  try {
    return await catalogApi('content', { params: { key }, query: { locale } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
