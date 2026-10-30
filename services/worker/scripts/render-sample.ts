/* eslint-disable no-console -- script de línea de comandos: el resultado se lee en la consola. */
/**
 * Maqueta un libro de muestra sin IA ni costos: un JSON con el libro y una carpeta con las
 * ilustraciones (0 = portada, 1..n = páginas). Genera el PDF digital y los de imprenta y los
 * valida. Uso:
 *   pnpm --filter @storynido/worker exec tsx scripts/render-sample.ts <libro.json> <imagenes/> <salida/>
 * Con --gelato (y GELATO_API_KEY) usa la tapa real de Gelato y arma su PDF único (gratis).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GelatoPrintProvider } from '@storynido/providers';
import { countWords, printPageCount } from '@storynido/shared';
import QRCode from 'qrcode';
import sharp from 'sharp';

import { textPlacements } from '../src/pdf/placement';

import { assembleSinglePdf } from '../src/pdf/assemble';
import { launchBrowser, renderPdf } from '../src/pdf/render';
import { FORMAT_SPECS, pageSizeMm, type FormatSpec } from '../src/pdf/spec';
import {
  defaultCoverGeometry,
  digitalHtml,
  interiorPages,
  printCoverHtml,
  printInteriorHtml,
  type LayoutBook,
} from '../src/pdf/templates';
import { effectiveDpi, validatePdf } from '../src/pdf/validate';

const [bookFile, imageDir, outDir] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const gelato =
  process.argv.includes('--gelato') && process.env.GELATO_API_KEY
    ? new GelatoPrintProvider({ apiKey: process.env.GELATO_API_KEY, orderType: 'draft' })
    : null;
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

const sources = book.pages.map((_, index) =>
  readFileSync(path.join(imageDir, imageFor(index + 1) ?? '')),
);
const placements = await textPlacements(
  sources.map((image, index) => ({ image, words: countWords(book.pages[index]?.text ?? '') })),
  { allowCorners: book.density !== 'rich' },
);
console.log(`ubicación del texto: ${placements.join(', ')}`);
const qr = {
  svg: await QRCode.toString('https://storynido.com', {
    type: 'svg',
    margin: 0,
    color: { dark: '#342a40', light: '#0000' },
  }),
  label: 'storynido.com',
};

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
      pages: pages.map((page, index) => ({
        text: page.text,
        image: page.uri,
        placement: placements[index],
      })),
      qr,
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
    } else if (spec.format === 'booklet') {
      // Cuento grapado: un solo PDF con portada, páginas y contratapa; cierra en múltiplo de 4.
      const interiorCount = interiorPages(layout, spec).length;
      const filler = printPageCount('booklet', interiorCount) - 2 - interiorCount;
      const stapled = { ...layout, fillerPages: filler };
      const result = await renderPdf(browser, digitalHtml(stapled, spec), size, {
        bleedMm: spec.bleedMm,
        title: book.title,
      });
      writeFileSync(path.join(outDir, 'booklet-libro.pdf'), result.pdf);
      report(
        'booklet',
        await validatePdf(result.pdf, {
          pages: interiorCount + filler + 2,
          widthMm: size.width,
          heightMm: size.height,
          bleedMm: spec.bleedMm,
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
      // Gelato pide 28 páginas como mínimo: con menos, la tapa se mide para 28.
      const gelatoSpec = gelato
        ? await gelato.fileSpec({
            format: spec.format,
            pageCount: Math.max(count, 28),
            quantity: 1,
          })
        : null;
      const geometry = gelatoSpec?.cover ?? defaultCoverGeometry(spec, count);
      const coverSize = { width: geometry.widthMm, height: geometry.heightMm };
      const tapas = await renderPdf(
        browser,
        printCoverHtml(layout, spec, geometry, !gelatoSpec),
        coverSize,
        {
          bleedMm: geometry.edgeMm,
          title: book.title,
        },
      );
      if (gelatoSpec) {
        const single = await assembleSinglePdf(tapas.pdf, interior.pdf);
        writeFileSync(path.join(outDir, `${spec.format}-gelato-libro.pdf`), single);
        console.log(
          `  gelato ${spec.format}: tapa ${String(geometry.widthMm)}×${String(geometry.heightMm)} mm, lomo ${String(geometry.spineWidthMm)} mm, ${String(count + 3)} páginas`,
        );
      }
      writeFileSync(path.join(outDir, `${spec.format}-tapas.pdf`), tapas.pdf);
      report(
        `${spec.format} tapas`,
        await validatePdf(tapas.pdf, {
          pages: 1,
          widthMm: coverSize.width,
          heightMm: coverSize.height,
          bleedMm: geometry.edgeMm,
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
