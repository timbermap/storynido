/**
 * Página armada para el golden set y la mesa de jueces (25 nov 2026, Benicio en el médico): la ilustración con el texto
 * y el papel fundido, con la misma geometría que el PDF y el lector (page-layout.ts). Así el examen
 * y el juez comprador miran lo que ve el cliente, no el dibujo suelto.
 */
import {
  CALM_ZONE_PCT,
  vignetteArtPct,
  vignetteMaskStop,
  type PageLayout,
  type StoryTypography,
} from '@storynido/shared';
import sharp from 'sharp';

const WIDTH = 768;
const HEIGHT = 1024;
const PAPER = '#fffaf3';
const INK = '#3d2f45';

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Corta el texto en líneas que entran en el ancho, con un ancho de letra aproximado. */
function wrap(text: string, fontPx: number, widthPx: number, uppercase: boolean): string[] {
  const perLine = Math.max(6, Math.floor(widthPx / (fontPx * (uppercase ? 0.72 : 0.55))));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= perLine) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textSvg(
  text: string,
  zone: { top: number; height: number },
  typography: Pick<StoryTypography, 'uppercase'> | null,
  fontPt: number | undefined,
  panel: boolean,
): Buffer {
  const uppercase = typography?.uppercase ?? false;
  const shown = uppercase ? text.toLocaleUpperCase('es') : text;
  // pt → % del ancho de la hoja (15,5 pt ≈ 3,9 %), igual que textHeightPct.
  const fontPx = Math.round(((fontPt ?? 16) * 0.25 * WIDTH) / 100);
  const lines = wrap(shown, fontPx, WIDTH * 0.8, uppercase);
  const lineHeight = fontPx * 1.375;
  const blockHeight = lines.length * lineHeight;
  const startY = zone.top + Math.max(0, (zone.height - blockHeight) / 2) + fontPx;
  const rows = lines
    .map(
      (line, index) =>
        `<text x="${String(WIDTH / 2)}" y="${String(Math.round(startY + index * lineHeight))}" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join('');
  const back = panel
    ? `<rect x="${String(WIDTH * 0.06)}" y="${String(zone.top + 8)}" width="${String(WIDTH * 0.88)}" height="${String(zone.height - 16)}" rx="40" fill="${PAPER}" fill-opacity="0.82"/>`
    : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${String(HEIGHT)}">${back}<g font-family="Quicksand, Arial, sans-serif" font-weight="700" font-size="${String(fontPx)}" fill="${INK}">${rows}</g></svg>`,
  );
}

/**
 * Arma la página: en el papel fundido, la caja del dibujo llega hasta la zona del texto y se funde
 * en una franja angosta; en la zona calma, el texto va encima del dibujo entero. Sin texto o con
 * texto enfrentado, la ilustración va entera.
 */
export async function composePage(
  image: Uint8Array,
  layout: PageLayout,
  text: string,
  typography: Pick<StoryTypography, 'uppercase'> | null,
): Promise<Buffer> {
  const hasText = Boolean(text.trim());
  if (!hasText || (layout.kind !== 'vignette' && layout.kind !== 'calm')) {
    return sharp(image).resize(WIDTH, HEIGHT, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  }
  const zonePct = layout.zonePct ?? CALM_ZONE_PCT;
  const top = layout.side === 'top';
  if (layout.kind === 'calm') {
    const zoneHeight = Math.round((HEIGHT * zonePct) / 100);
    const zone = { top: top ? 0 : HEIGHT - zoneHeight, height: zoneHeight };
    return sharp(image)
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .composite([{ input: textSvg(text, zone, typography, layout.fontPt, true) }])
      .webp({ quality: 82 })
      .toBuffer();
  }
  const artHeight = Math.round((HEIGHT * vignetteArtPct(zonePct)) / 100);
  const stop = vignetteMaskStop(zonePct);
  // La máscara: opaca del lado opuesto al texto y transparente en la franja que toca la zona.
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${String(artHeight)}"><defs><linearGradient id="g" x1="0" y1="${top ? '1' : '0'}" x2="0" y2="${top ? '0' : '1'}"><stop offset="${String(stop)}%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  const art = await sharp(image)
    .resize(WIDTH, artHeight, { fit: 'cover', position: top ? 'bottom' : 'top' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const zoneHeight = Math.round((HEIGHT * zonePct) / 100);
  const zone = { top: top ? 0 : HEIGHT - zoneHeight, height: zoneHeight };
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: PAPER } })
    .composite([
      { input: art, top: top ? HEIGHT - artHeight : 0, left: 0 },
      { input: textSvg(text, zone, typography, layout.fontPt, false) },
    ])
    .webp({ quality: 82 })
    .toBuffer();
}
