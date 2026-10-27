/* eslint-disable no-console -- script de línea de comandos: el resultado se lee en la consola. */
/**
 * Maqueta un libro de muestra sin IA ni costos: un JSON con el libro y una carpeta con las
 * ilustraciones (0 = portada, 1..n = páginas). Genera el PDF digital y los de imprenta y los
 * valida. Uso:
 *   pnpm --filter @storynido/worker exec tsx scripts/render-sample.ts <libro.json> <imagenes/> <salida/>
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { launchBrowser, renderPdf } from '../src/pdf/render';
import { FORMAT_SPECS, pageSizeMm, type FormatSpec } from '../src/pdf/spec';
import {
  coverSizeMm,
  digitalHtml,
  interiorPages,
  printCoverHtml,
  printInteriorHtml,
  type LayoutBook,
} from '../src/pdf/templates';
import { effectiveDpi, validatePdf } from '../src/pdf/validate';

const [bookFile, imageDir, outDir] = process.argv.slice(2);
if (!bookFile || !imageDir || !outDir)
  throw new Error('Uso: render-sample.ts <libro.json> <imagenes/> <salida/>');
mkdirSync(outDir, { recursive: true });

const book = JSON.parse(readFileSync(bookFile, 'utf8')) as Omit<LayoutBook, 'cover' | 'pages'> & {
  pages: { text: string }[];
};
const files = readdirSync(imageDir);
/** La versión reparada más reciente de cada ilustración, si existe. */
const imageFor = (index: number) =>
  files
    .filter((name) => new RegExp(`^illustration-${String(index)}(-r\\d+)?\\.webp$`).test(name))
    .sort()
    .at(-1);

async function dataUri(file: string, spec: FormatSpec) {
  const image = sharp(path.join(imageDir ?? '', file));
  const { width } = await image.metadata();
  const jpeg = await image
    .resize({ width: Math.min(width, spec.maxImagePx), withoutEnlargement: true })
    .jpeg({ quality: spec.jpegQuality })
    .toBuffer();
  return { uri: `data:image/jpeg;base64,${jpeg.toString('base64')}`, width };
}

const browser = await launchBrowser();
try {
  for (const spec of Object.values(FORMAT_SPECS)) {
    const cover = await dataUri(imageFor(0) ?? '', spec);
    const pages = await Promise.all(
      book.pages.map(async (page, index) => ({
        text: page.text,
        ...(await dataUri(imageFor(index + 1) ?? '', spec)),
      })),
    );
    const layout: LayoutBook = {
      ...book,
      cover: cover.uri,
      pages: pages.map((page) => ({ text: page.text, image: page.uri })),
    };
    const size = pageSizeMm(spec);
    const lowDpi = [cover, ...pages]
      .map((image, index) => ({ index, dpi: Math.round(effectiveDpi(image.width, size.width)) }))
      .filter((image) => image.dpi < spec.minDpi);
    const report = (
      name: string,
      check: { ok: boolean; errors: string[]; pageCount: number },
      overflow: string[],
    ) => {
      console.log(
        `${check.ok && overflow.length === 0 ? '✓' : '✗'} ${name}: ${String(check.pageCount)} páginas${
          overflow.length ? ` · texto desbordado en ${overflow.join(', ')}` : ''
        }${check.errors.length ? ` · ${check.errors.join('; ')}` : ''}`,
      );
    };

    if (spec.format === 'digital') {
      const result = await renderPdf(browser, digitalHtml(layout, spec), size, {
        bleedMm: 0,
        title: book.title,
      });
      writeFileSync(path.join(outDir, 'libro-digital.pdf'), result.pdf);
      const expected = interiorPages(layout, spec).length + 2;
      report(
        'digital',
        await validatePdf(result.pdf, {
          pages: expected,
          widthMm: size.width,
          heightMm: size.height,
          bleedMm: 0,
        }),
        result.overflow,
      );
    } else {
      const interior = await renderPdf(browser, printInteriorHtml(layout, spec), size, {
        bleedMm: spec.bleedMm,
        title: book.title,
      });
      writeFileSync(path.join(outDir, `${spec.format}-interior.pdf`), interior.pdf);
      const count = interiorPages(layout, spec).length;
      report(
        `${spec.format} interior`,
        await validatePdf(interior.pdf, {
          pages: count,
          widthMm: size.width,
          heightMm: size.height,
          bleedMm: spec.bleedMm,
        }),
        interior.overflow,
      );
      const coverSize = coverSizeMm(spec, count);
      const tapas = await renderPdf(browser, printCoverHtml(layout, spec, count), coverSize, {
        bleedMm: spec.bleedMm,
        title: book.title,
      });
      writeFileSync(path.join(outDir, `${spec.format}-tapas.pdf`), tapas.pdf);
      report(
        `${spec.format} tapas`,
        await validatePdf(tapas.pdf, {
          pages: 1,
          widthMm: coverSize.width,
          heightMm: coverSize.height,
          bleedMm: spec.bleedMm,
        }),
        tapas.overflow,
      );
    }
    if (lowDpi.length > 0) {
      console.log(
        `  ⚠ ${spec.format}: resolución baja (${String(spec.minDpi)} dpi mín.): ${lowDpi.map((image) => `${image.index === 0 ? 'portada' : `pág. ${String(image.index)}`} ${String(image.dpi)} dpi`).join(', ')}`,
      );
    }
  }
} finally {
  await browser.close();
}
