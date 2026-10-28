/* eslint-disable no-console -- script de línea de comandos: el reporte va a la consola. */
/**
 * Lighthouse (fase 17): páginas clave en móvil y escritorio, umbral 90 en rendimiento,
 * accesibilidad, buenas prácticas y SEO. Corre contra la web compilada (`next start`).
 *
 *   node perf/lighthouse.mjs [baseUrl]
 */
import { writeFileSync, mkdirSync } from 'node:fs';

import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const THRESHOLD = 0.9;
const PAGES = [
  '/es',
  '/es/historias',
  '/es/historias/aventura-espacial',
  '/es/crear',
  '/en',
  '/pt/familias',
];
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
/** El creador es privado (noindex a propósito): sin categoría SEO. */
const PRIVATE = new Set(['/es/crear']);

const chrome = await chromeLauncher.launch({
  chromePath: process.env.E2E_CHROME_PATH,
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
const rows = [];
let failed = false;
try {
  for (const form of ['mobile', 'desktop']) {
    for (const path of PAGES) {
      const result = await lighthouse(
        `${BASE}${path}`,
        {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: PRIVATE.has(path) ? CATEGORIES.filter((id) => id !== 'seo') : CATEGORIES,
          // Local y staging son noindex a propósito (no indexar el sitio de prueba); en producción
          // se indexa. El resto de SEO sí se mide.
          skipAudits: ['is-crawlable'],
        },
        form === 'desktop' ? desktopConfig : undefined,
      );
      const scores = Object.fromEntries(
        CATEGORIES.filter((id) => result.lhr.categories[id]).map((id) => [
          id,
          Math.round((result.lhr.categories[id]?.score ?? 0) * 100),
        ]),
      );
      const low = Object.entries(scores).filter(([, score]) => score < THRESHOLD * 100);
      if (low.length) failed = true;
      rows.push({ form, path, ...scores, ok: low.length ? '✗' : '✓' });
      if (low.length) {
        // Las auditorías que más restan, para saber qué arreglar.
        const audits = Object.values(result.lhr.audits)
          .filter(
            (audit) =>
              audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode !== 'informative',
          )
          .slice(0, 6)
          .map((audit) => `${audit.id} (${String(audit.score)})`);
        rows.push({ form, path: `  ↳ ${audits.join(', ')}` });
      }
    }
  }
} finally {
  await chrome.kill();
}
console.table(rows);
mkdirSync('perf/results', { recursive: true });
writeFileSync('perf/results/lighthouse.json', JSON.stringify(rows, null, 2));
if (failed) {
  console.error(`Hay categorías por debajo de ${String(THRESHOLD * 100)}.`);
  process.exitCode = 1;
}
