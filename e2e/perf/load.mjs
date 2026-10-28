/* eslint-disable no-console -- script de línea de comandos: el reporte va a la consola. */
/**
 * Prueba de carga básica (fase 17) de la API con proveedores simulados: las rutas públicas que
 * más se llaman (catálogo y modo del sitio). Mide latencia y throughput de una instancia.
 *
 *   node perf/load.mjs [apiUrl] [segundos] [conexiones]
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import autocannon from 'autocannon';

const API = process.argv[2] ?? 'http://localhost:8080';
const duration = Number(process.argv[3] ?? 20);
const connections = Number(process.argv[4] ?? 50);
const ROUTES = [
  '/health',
  '/v1/site-config',
  '/v1/catalog/stories?locale=es',
  '/v1/catalog/collections?locale=es&channel=professionals',
];

const results = [];
for (const path of ROUTES) {
  const run = await autocannon({ url: `${API}${path}`, connections, duration });
  results.push({
    ruta: path,
    'req/s': Math.round(run.requests.average),
    'p50 ms': run.latency.p50,
    'p99 ms': run.latency.p99,
    errores: run.errors + run.non2xx,
  });
}
console.table(results);
mkdirSync('perf/results', { recursive: true });
writeFileSync(
  'perf/results/load.json',
  JSON.stringify({ duration, connections, results }, null, 2),
);
