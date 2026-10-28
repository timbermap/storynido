import type { Browser } from 'playwright-core';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { blend, contrastRatio } from './contrast';
import { mazeSvg } from './maze';
import { textPlacements } from './placement';
import { chromePath, launchBrowser, renderPdf } from './render';
import { FORMAT_SPECS, pageSizeMm, printablePages } from './spec';
import {
  DENSITY_LAYOUT,
  INK,
  PANEL_ALPHA,
  PAPER,
  digitalHtml,
  interiorPages,
  printInteriorHtml,
  type LayoutBook,
} from './templates';
import { effectiveDpi, validatePdf } from './validate';

describe('reglas de maquetación', () => {
  it('el texto sobre el panel tiene contraste AA incluso sobre una ilustración negra', () => {
    expect(contrastRatio(INK, PAPER)).toBeGreaterThan(12);
    expect(contrastRatio(INK, blend(PAPER, PANEL_ALPHA))).toBeGreaterThanOrEqual(4.5);
  });

  it('el panel de texto nunca tapa más de la mitad de la ilustración', () => {
    for (const layout of Object.values(DENSITY_LAYOUT)) {
      expect(layout.panelPct).toBeLessThanOrEqual(50);
      expect(layout.minPt).toBeGreaterThanOrEqual(10);
    }
  });

  it('las reglas de la imprenta marcan el libro como solo digital si no cumple', () => {
    expect(printablePages(FORMAT_SPECS.softcover, 12)).toBe(true);
    expect(printablePages(FORMAT_SPECS.softcover, 13)).toBe(false);
    expect(printablePages(FORMAT_SPECS.hardcover, 12)).toBe(false);
    expect(printablePages(FORMAT_SPECS.digital, 7)).toBe(true);
  });

  it('una ilustración 2K da al menos 200 dpi a página completa con sangrado', () => {
    const width = pageSizeMm(FORMAT_SPECS.hardcover).width;
    expect(effectiveDpi(1792, width)).toBeGreaterThan(200);
    expect(effectiveDpi(896, width)).toBeLessThan(FORMAT_SPECS.hardcover.minDpi);
  });

  it('el texto va en la región más calma de la ilustración', async () => {
    // Arriba liso (cielo), abajo con mucho detalle (personajes): el texto va arriba.
    const busyBottom = await sharp({
      create: { width: 300, height: 400, channels: 3, background: { r: 180, g: 200, b: 240 } },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="300" height="200"><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#222"/></pattern><rect width="300" height="200" fill="url(#p)"/></svg>`,
          ),
          top: 200,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
    const [placement] = await textPlacements([{ image: busyBottom, words: 80 }], {
      allowCorners: false,
    });
    expect(placement).toBe('top');
    // Textos cortos pueden ir en una esquina; nunca se repite igual si hay otra parecida.
    const flat = await sharp({
      create: { width: 300, height: 400, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .png()
      .toBuffer();
    const many = await textPlacements(
      [flat, flat, flat].map((image) => ({ image, words: 20 })),
      { allowCorners: true },
    );
    expect(many[0]).toBe('bottom');
    expect(many[1]).not.toBe('bottom');
  });

  it('el laberinto es determinístico y tiene entrada y salida', () => {
    expect(mazeSvg(8, 10, 42)).toBe(mazeSvg(8, 10, 42));
    expect(mazeSvg(8, 10, 42)).not.toBe(mazeSvg(8, 10, 43));
    expect(mazeSvg(8, 10, 42)).toContain('<circle');
  });
});

// El render necesita Chromium (Chrome en la Mac, google-chrome en CI, chromium en Docker).
describe.skipIf(!chromePath())('PDF', () => {
  let browser: Browser;
  let image: string;

  beforeAll(async () => {
    browser = await launchBrowser();
    const jpeg = await sharp({
      create: { width: 900, height: 1200, channels: 3, background: { r: 200, g: 180, b: 230 } },
    })
      .jpeg()
      .toBuffer();
    image = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  }, 30_000);

  afterAll(async () => {
    await browser.close();
  });

  const book = (overrides: Partial<LayoutBook> = {}): LayoutBook => ({
    language: 'es',
    title: 'La gran aventura de Martín',
    childName: 'Martín',
    dedication: 'Para Martín, que sueña con las estrellas.',
    contentType: 'story',
    density: 'balanced',
    readingLevel: 'developing',
    cover: image,
    pages: Array.from({ length: 4 }, (_, index) => ({
      text: `Martín vive la página ${String(index + 1)} de su aventura con su perro Rocco y mira la luna.`,
      image,
    })),
    activities: [
      {
        kind: 'maze',
        title: 'Ayuda a Martín',
        instructions: 'Llega al cohete.',
        items: ['Martín'],
        illustrationPrompt: null,
      },
      {
        kind: 'match',
        title: 'Une',
        instructions: 'Une cada uno.',
        items: ['Martín', 'Rocco', 'Luna'],
        illustrationPrompt: null,
      },
    ],
    ...overrides,
  });

  it('Profesionales: el cierre lleva el aviso de material educativo no clínico', () => {
    const spec = FORMAT_SPECS.digital;
    const last = (overrides: Partial<LayoutBook>) => interiorPages(book(overrides), spec).join('');
    expect(last({})).not.toContain('class="notice"');
    const pro = last({ educationalNotice: true });
    expect(pro).toContain('Material educativo creado con StoryNido');
    expect(pro).toContain('intervención profesional o clínica');
    expect(last({ educationalNotice: true, language: 'en' })).toContain(
      'professional or clinical intervention',
    );
  });

  it('digital: páginas, tamaño 21×28 y tipografías embebidas', async () => {
    const spec = FORMAT_SPECS.digital;
    const layout = book();
    const result = await renderPdf(browser, digitalHtml(layout, spec), pageSizeMm(spec), {
      bleedMm: 0,
      title: layout.title,
    });
    expect(result.overflow).toEqual([]);
    // Portada + dedicatoria + 4 páginas + 2 actividades + fin + contratapa.
    const check = await validatePdf(result.pdf, {
      pages: 10,
      widthMm: 210,
      heightMm: 280,
      bleedMm: 0,
    });
    expect(check).toEqual({ ok: true, errors: [], pageCount: 10 });
  }, 30_000);

  it('imprenta: página con sangrado de 3 mm y área de corte marcada', async () => {
    const spec = FORMAT_SPECS.softcover;
    const layout = book();
    const size = pageSizeMm(spec);
    const result = await renderPdf(browser, printInteriorHtml(layout, spec), size, {
      bleedMm: spec.bleedMm,
      title: layout.title,
    });
    expect(size).toEqual({ width: 216, height: 286 });
    const check = await validatePdf(result.pdf, {
      pages: interiorPages(layout, spec).length,
      widthMm: 216,
      heightMm: 286,
      bleedMm: 3,
    });
    expect(check.ok).toBe(true);
    // Una página de otro tamaño o sin sangrado no pasa.
    const wrong = await validatePdf(result.pdf, {
      pages: 99,
      widthMm: 210,
      heightMm: 280,
      bleedMm: 5,
    });
    expect(wrong.ok).toBe(false);
    expect(wrong.errors.join(' ')).toMatch(/páginas: .* en vez de 99/);
    expect(wrong.errors.join(' ')).toContain('sangrado');
  }, 30_000);

  it('el texto que no entra ni con la letra mínima bloquea la maquetación', async () => {
    const spec = FORMAT_SPECS.digital;
    const layout = book({
      density: 'visual',
      pages: [{ text: 'Una frase muy larga. '.repeat(120), image }],
      activities: [],
    });
    const result = await renderPdf(browser, digitalHtml(layout, spec), pageSizeMm(spec), {
      bleedMm: 0,
      title: layout.title,
    });
    expect(result.overflow).toEqual(['página 1']);
  }, 30_000);
});
