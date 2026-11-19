import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { STYLE_SHEETS } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { failedCheck, toColoringPage } from './images';

/**
 * Set fijo de pruebas de las fichas (DECISIONS 282): cada muestra aprobada de un estilo pasa el
 * control de su propia ficha, y la de colorear no pasa el de un estilo a color (y al revés). Si
 * alguien cambia un tope, este test dice qué muestras dejan de pasar.
 */
const STYLES_DIR = join(__dirname, '../../../apps/web/public/styles');

function samplesOf(slug: string): string[] {
  const files = [join(STYLES_DIR, `${slug}.webp`)];
  const folder = join(STYLES_DIR, slug);
  try {
    if (statSync(folder).isDirectory()) {
      for (const name of readdirSync(folder)) {
        if (name.endsWith('.webp')) files.push(join(folder, name));
      }
    }
  } catch {
    // Sin carpeta de muestras extra: alcanza con la principal.
  }
  return files;
}

describe('fichas de estilo: control automático', () => {
  it.each(Object.keys(STYLE_SHEETS))('las muestras de %s pasan su propio control', async (slug) => {
    const sheet = STYLE_SHEETS[slug];
    if (!sheet) throw new Error(slug);
    for (const file of samplesOf(slug)) {
      expect(await failedCheck(new Uint8Array(readFileSync(file)), sheet.check), file).toBeNull();
    }
  });

  it('una página pintada no pasa el control de colorear, y una de colorear no pasa el de acuarela', async () => {
    const coloring = STYLE_SHEETS['para-colorear']?.check ?? {};
    const watercolor = STYLE_SHEETS.acuarela?.check ?? {};
    const painted = new Uint8Array(readFileSync(join(STYLES_DIR, 'acuarela.webp')));
    const lineArt = new Uint8Array(readFileSync(join(STYLES_DIR, 'para-colorear.webp')));
    expect(await failedCheck(painted, coloring)).toContain('painted in color');
    expect(await failedCheck(lineArt, watercolor)).toContain('black and white');
  });

  it('una ilustración pintada pasada a página para colorear queda sin color', async () => {
    const painted = new Uint8Array(readFileSync(join(STYLES_DIR, 'cartoon-3d.webp')));
    const page = await toColoringPage(painted);
    expect(await failedCheck(page, STYLE_SHEETS['para-colorear']?.check ?? {})).toBeNull();
  });
});
