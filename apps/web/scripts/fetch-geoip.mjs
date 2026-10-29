/* eslint-disable no-console -- script de compilación: informa por consola. */
/**
 * Baja la base de país por IP de DB-IP ("IP to Country Lite", CC BY 4.0) antes de compilar la
 * web. Se consulta en el propio servidor: la IP del visitante no sale a ningún tercero. Si no se
 * puede bajar, la web compila igual y el país sale del idioma del navegador.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const target = path.join(import.meta.dirname, '..', 'geo', 'dbip-country-lite.mmdb');
const MAX_AGE_MS = 20 * 24 * 3600 * 1000;

if (existsSync(target) && Date.now() - statSync(target).mtimeMs < MAX_AGE_MS) {
  console.info('geoip: base vigente, no se baja.');
  process.exit(0);
}

const months = [0, 1].map((back) => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - back);
  return date.toISOString().slice(0, 7);
});

for (const month of months) {
  try {
    const response = await fetch(
      `https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`,
    );
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const data = gunzipSync(Buffer.from(await response.arrayBuffer()));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, data);
    console.info(`geoip: base ${month} (${String(Math.round(data.length / 1024))} KB).`);
    process.exit(0);
  } catch (error) {
    console.warn(
      `geoip: no se pudo bajar ${month}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
console.warn('geoip: sin base; el país se detecta por el idioma del navegador.');
