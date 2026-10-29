import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Reader, type CountryResponse } from 'mmdb-lib';

/** Base de país por IP (DB-IP Lite, la baja `scripts/fetch-geoip.mjs` al compilar). */
const DB_PATH = path.join(process.cwd(), 'geo', 'dbip-country-lite.mmdb');

let reader: Reader<CountryResponse> | null | undefined;

function load() {
  if (reader !== undefined) return reader;
  try {
    reader = new Reader<CountryResponse>(readFileSync(DB_PATH));
  } catch {
    // Sin base (desarrollo o descarga fallida): el país sale del idioma del navegador.
    reader = null;
  }
  return reader;
}

/** IP del visitante: App Hosting la manda en `x-fah-client-ip`; si no, la primera del proxy. */
export function clientIp(headers: Pick<Headers, 'get'>): string | null {
  const direct = headers.get('x-fah-client-ip')?.trim();
  if (direct) return direct;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded?.length ? forwarded : null;
}

/** País (ISO 3166-1 alfa-2) de una IP, o null. La IP no se guarda ni sale del servidor. */
export function countryFromIp(ip: string | null): string | null {
  if (!ip) return null;
  try {
    return load()?.get(ip)?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}
