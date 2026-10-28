/**
 * Vista previa local de las plantillas: escribe cada mail (en es, en y pt) como HTML.
 *   pnpm --filter @storynido/emails preview [salida/]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { EMAIL_TEMPLATES, LOCALES } from '@storynido/shared';

import { DEFAULT_BRAND } from '../src/brand';
import { renderEmail } from '../src/render';
import { SAMPLE_DATA } from '../src/samples';

const outDir = process.argv[2] ?? path.join(process.cwd(), 'preview');
mkdirSync(outDir, { recursive: true });
const links: string[] = [];
for (const template of EMAIL_TEMPLATES) {
  for (const locale of LOCALES) {
    const mail = await renderEmail(
      {
        to: 'ana@example.com',
        template,
        locale,
        data: SAMPLE_DATA[template],
        idempotencyKey: 'preview',
      },
      DEFAULT_BRAND,
    );
    const file = `${template}.${locale}.html`;
    writeFileSync(path.join(outDir, file), mail.html);
    links.push(`<li><a href="${file}">${template} (${locale})</a> — ${mail.subject}</li>`);
  }
}
writeFileSync(
  path.join(outDir, 'index.html'),
  `<meta charset="utf-8"><h1>Mails de StoryNido</h1><ul>${links.join('')}</ul>`,
);
console.log(`${String(links.length)} mails en ${outDir}/index.html`);
