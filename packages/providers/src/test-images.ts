import sharp from 'sharp';

/** Imagen de prueba con textura (nítida) o lisa (borrosa), del brillo pedido. */
export async function testImage(options: {
  width: number;
  height: number;
  brightness?: number;
  textured?: boolean;
  format?: 'jpeg' | 'png';
  orientation?: number;
}): Promise<Uint8Array> {
  const { width, height, brightness = 130, textured = true } = options;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Tablero de 8 px: bordes marcados que el filtro Laplaciano detecta como nitidez.
      const offset = textured && (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 30 : -30;
      const value = Math.max(0, Math.min(255, brightness + (textured ? offset : 0)));
      const i = (y * width + x) * 3;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
    }
  }
  let image = sharp(pixels, { raw: { width, height, channels: 3 } });
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  const data =
    options.format === 'png' ? await image.png().toBuffer() : await image.jpeg().toBuffer();
  return new Uint8Array(data);
}
