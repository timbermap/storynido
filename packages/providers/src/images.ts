import sharp from 'sharp';

import type { FaceBox } from '@storynido/shared';

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
  const size = Math.min(Math.round(Math.max(face.width, face.height) * 2.4), width, height);
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
