import { existsSync } from 'node:fs';

import { PDFDocument, PDFName, type PDFPage } from 'pdf-lib';
import { chromium, type Browser } from 'playwright-core';

import { PT_PER_MM } from './spec';

/** Chromium: el de la imagen Docker, el de CI (Ubuntu) o Chrome en la Mac. */
export function chromePath(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((path): path is string => Boolean(path && existsSync(path))) ?? null;
}

export async function launchBrowser(): Promise<Browser> {
  const executablePath = chromePath();
  if (!executablePath) throw new Error('No hay Chromium para generar el PDF (CHROME_PATH).');
  return chromium.launch({ executablePath, args: ['--no-sandbox', '--font-render-hinting=none'] });
}

export interface RenderResult {
  pdf: Uint8Array;
  /** Páginas cuyo texto no entró ni con la letra mínima. */
  overflow: string[];
  pageCount: number;
}

/**
 * HTML → PDF. Espera las tipografías y el ajuste de texto; en imprenta marca el área de corte
 * (TrimBox) y el sangrado (BleedBox) para que la imprenta sepa dónde corta.
 */
export async function renderPdf(
  browser: Browser,
  html: string,
  sizeMm: { width: number; height: number },
  options: { bleedMm: number; title: string },
): Promise<RenderResult> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    // Se evalúa como texto: el worker no tiene los tipos del DOM.
    await page.waitForFunction('window.__fitted === true', null, { timeout: 30_000 });
    const overflow = await page.evaluate<string[]>(
      `[...document.querySelectorAll('.page[data-overflow="true"]')].map((e) => e.dataset.label || '?')`,
    );
    const raw = await page.pdf({
      width: `${String(sizeMm.width)}mm`,
      height: `${String(sizeMm.height)}mm`,
      printBackground: true,
      preferCSSPageSize: true,
    });
    const doc = await PDFDocument.load(raw);
    doc.setTitle(options.title);
    doc.setAuthor('StoryNido');
    doc.setCreator('StoryNido');
    if (options.bleedMm > 0) {
      for (const pdfPage of doc.getPages()) setPrintBoxes(pdfPage, options.bleedMm);
    }
    return { pdf: await doc.save(), overflow, pageCount: doc.getPageCount() };
  } finally {
    await page.close();
  }
}

function setPrintBoxes(page: PDFPage, bleedMm: number) {
  const { width, height } = page.getSize();
  const bleed = bleedMm * PT_PER_MM;
  page.setBleedBox(0, 0, width, height);
  page.setTrimBox(bleed, bleed, width - 2 * bleed, height - 2 * bleed);
  page.node.set(
    PDFName.of('ArtBox'),
    page.node.context.obj([bleed, bleed, width - bleed, height - bleed]),
  );
}
