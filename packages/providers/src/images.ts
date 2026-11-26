import sharp from 'sharp';

import type { FaceBox, ImageCheck } from '@storynido/shared';

import { WATERMARK_TILE_PNG_BASE64 } from './watermark-tile';

/** Lado máximo con el que se analiza y guarda una foto (suficiente para ilustrar). */
const MAX_SIDE = 2048;

/**
 * Corrige la orientación (EXIF), limita el tamaño y convierte a JPEG sin metadatos
 * (se descartan GPS y datos de la cámara). Falla si el archivo no es una imagen.
 */
export async function normalizeImage(
  input: Uint8Array,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { bytes: new Uint8Array(data), width: info.width, height: info.height };
}

/** Brillo medio (0-255) y nitidez (desvío de los bordes detectados con un filtro Laplaciano). */
export async function imageQuality(
  input: Uint8Array,
): Promise<{ brightness: number; sharpness: number }> {
  const gray = sharp(input).grayscale().resize({ width: 512, height: 512, fit: 'inside' });
  const [stats, edges] = await Promise.all([
    gray.clone().stats(),
    gray
      .clone()
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
      .stats(),
  ]);
  return { brightness: stats.channels[0]?.mean ?? 0, sharpness: edges.channels[0]?.stdev ?? 0 };
}

/**
 * Recorte cuadrado centrado en la cara (con margen para pelo y hombros), 1024 px,
 * contraste normalizado y un leve realce. Devuelve JPEG sin metadatos.
 */
export async function cropPortrait(
  input: Uint8Array,
  face: FaceBox,
  width: number,
  height: number,
): Promise<Uint8Array> {
  // 1,8 veces la cara (antes 2,4): entran el pelo y el cuello, pero no las manos ni la pose, que
  // el dibujo copiaba (mano en la cara; DECISIONS 288).
  const size = Math.min(Math.round(Math.max(face.width, face.height) * 1.8), width, height);
  const centerX = face.left + face.width / 2;
  const centerY = face.top + face.height / 2.2;
  const left = Math.round(Math.min(Math.max(centerX - size / 2, 0), width - size));
  const top = Math.round(Math.min(Math.max(centerY - size / 2, 0), height - size));
  const data = await sharp(input)
    .extract({ left, top, width: size, height: size })
    .resize(1024, 1024)
    .normalise({ lower: 1, upper: 99 })
    .modulate({ saturation: 1.05 })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(data);
}

/** Ilustración final sin marca, en WebP de alta calidad (se usa para el libro comprado). */
export async function encodeIllustration(
  input: Uint8Array,
  /** Recorta este porcentaje de cada borde (el modelo dibuja a veces franjas grises de marco). */
  trimEdgePct = 0,
): Promise<Uint8Array> {
  let image = sharp(input, { failOn: 'error' });
  if (trimEdgePct > 0) {
    const { width, height } = await image.metadata();
    if (width && height) {
      const dx = Math.round((width * trimEdgePct) / 100);
      const dy = Math.round((height * trimEdgePct) / 100);
      const trimmed = await image
        .extract({ left: dx, top: dy, width: width - 2 * dx, height: height - 2 * dy })
        .toBuffer();
      image = sharp(trimmed, { failOn: 'error' });
    }
  }
  const data = await image.webp({ quality: 92 }).toBuffer();
  return new Uint8Array(data);
}

/** Marca de agua tenue: en un dibujo para colorear la de siempre se confundía con las líneas. */
const FAINT_WATERMARK_ALPHA = 0.4;
let faintTile: Promise<Buffer> | null = null;

function faintWatermarkTile(): Promise<Buffer> {
  faintTile ??= (async () => {
    const { data, info } = await sharp(Buffer.from(WATERMARK_TILE_PNG_BASE64, 'base64'))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round((data[i] ?? 0) * FAINT_WATERMARK_ALPHA);
    }
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer();
  })();
  return faintTile;
}

/**
 * Versión de la vista previa: lado máximo 1024 px y la marca de agua en mosaico.
 * Es la única versión que ve el cliente antes de comprar. `faint`: más tenue (páginas para
 * colorear, DECISIONS 283).
 */
export async function watermarkPreview(
  input: Uint8Array,
  options: { faint?: boolean } = {},
): Promise<Uint8Array> {
  const resized = await sharp(input, { failOn: 'error' })
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .toBuffer();
  const tile = options.faint
    ? await faintWatermarkTile()
    : Buffer.from(WATERMARK_TILE_PNG_BASE64, 'base64');
  const data = await sharp(resized)
    .composite([{ input: tile, tile: true }])
    .webp({ quality: 80 })
    .toBuffer();
  return new Uint8Array(data);
}

/**
 * Cuánto color tiene una imagen (métrica de Hasler y Süsstrunk, 0 = gris). Una página para
 * colorear bien hecha da menos de 10; una ilustración pintada, más de 30.
 */
export async function colorfulness(input: Uint8Array): Promise<number> {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .resize({ width: 256, height: 256, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = Math.floor(data.length / info.channels);
  if (pixels === 0 || info.channels < 3) return 0;
  let rgSum = 0;
  let ybSum = 0;
  let rgSq = 0;
  let ybSq = 0;
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * info.channels;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    rgSum += rg;
    ybSum += yb;
    rgSq += rg * rg;
    ybSq += yb * yb;
  }
  const rgMean = rgSum / pixels;
  const ybMean = ybSum / pixels;
  const rgStd = Math.sqrt(Math.max(rgSq / pixels - rgMean * rgMean, 0));
  const ybStd = Math.sqrt(Math.max(ybSq / pixels - ybMean * ybMean, 0));
  return Math.hypot(rgStd, ybStd) + 0.3 * Math.hypot(rgMean, ybMean);
}

/** Saturación media (0-1) de una imagen. */
export async function meanSaturation(input: Uint8Array): Promise<number> {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .resize({ width: 256, height: 256, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = Math.floor(data.length / info.channels);
  if (pixels === 0 || info.channels < 3) return 0;
  let total = 0;
  for (let i = 0; i < pixels; i += 1) {
    const offset = i * info.channels;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const max = Math.max(r, g, b);
    total += max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  }
  return total / pixels;
}

/**
 * Lo que falla del control de la ficha del estilo (DECISIONS 282), o null si pasa. Mide la imagen
 * tal cual la devolvió el modelo.
 */
export async function failedCheck(input: Uint8Array, check: ImageCheck): Promise<string | null> {
  const needsColor = check.maxColorfulness !== undefined || check.minColorfulness !== undefined;
  if (needsColor) {
    const color = await colorfulness(input);
    if (check.maxColorfulness !== undefined && color > check.maxColorfulness) {
      return 'The previous attempt was painted in color. This time draw ONLY black line art on white: zero color, zero gray.';
    }
    if (check.minColorfulness !== undefined && color < check.minColorfulness) {
      return 'The previous attempt came out black and white or as an uncolored sketch. This time it is a fully colored illustration in the chosen art style.';
    }
  }
  if (check.maxSaturation !== undefined && (await meanSaturation(input)) > check.maxSaturation) {
    return 'The previous attempt was oversaturated and looked artificial. This time use calm, muted, dusty colors with a single accent, never neon, lime, candy or pure primaries.';
  }
  return null;
}

/**
 * Página para colorear: blanco y negro puro (sin color ni tintes), con los grises claros llevados a
 * blanco para que el papel quede limpio y los contornos bien negros. Es la garantía final: aunque
 * el modelo pinte algo, al cliente nunca le llega una página a color (Lu, 19 nov 2026).
 */
export async function toColoringPage(input: Uint8Array): Promise<Uint8Array> {
  const data = await sharp(input, { failOn: 'error' })
    .removeAlpha()
    .greyscale()
    .normalise({ lower: 1, upper: 99 })
    // Levanta los grises claros (fondos, sombras suaves) hacia el blanco del papel.
    .linear(1.35, -40)
    .png()
    .toBuffer();
  return new Uint8Array(data);
}

/**
 * La franja de la ilustración donde va el texto (arriba o abajo, `pct` por ciento del alto) con un
 * margen, recortada aparte. El juez de moderación adivinaba mal los porcentajes sobre la imagen
 * entera y dejaba pasar caras bajo el texto; sobre la franja sola solo tiene que decir si hay una
 * cara (ronda 3, 26 nov, DECISIONS 344). JPEG.
 */
export async function zoneStrip(
  input: Uint8Array,
  side: 'top' | 'bottom',
  pct: number,
  marginPct = 5,
): Promise<Uint8Array> {
  const image = sharp(input);
  const { width, height } = await image.metadata();
  const stripHeight = Math.max(
    1,
    Math.min(height, Math.round((height * Math.min(100, pct + marginPct)) / 100)),
  );
  const data = await image
    .extract({
      left: 0,
      top: side === 'top' ? 0 : height - stripHeight,
      width,
      height: stripHeight,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  return new Uint8Array(data);
}
