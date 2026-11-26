import { evaluatePhoto } from '@storynido/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { cropPortrait, imageQuality, normalizeImage, zoneStrip } from './images';
import { MockPhotoAnalyzer } from './mock/photo';
import { testImage } from './test-images';

describe('procesamiento de fotos', () => {
  it('normaliza: corrige la orientación EXIF, limita el tamaño y quita metadatos', async () => {
    const rotated = await testImage({ width: 3000, height: 2000, orientation: 6 });
    const { bytes, width, height } = await normalizeImage(rotated);
    expect([width, height]).toEqual([1365, 2048]);
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  it('rechaza archivos que no son imágenes', async () => {
    await expect(
      normalizeImage(new TextEncoder().encode('<svg></svg> no es una foto')),
    ).rejects.toThrow();
  });

  it('mide brillo y nitidez', async () => {
    const sharpImg = await imageQuality(await testImage({ width: 800, height: 800 }));
    const flat = await imageQuality(await testImage({ width: 800, height: 800, textured: false }));
    const dark = await imageQuality(
      await testImage({ width: 800, height: 800, brightness: 15, textured: false }),
    );
    expect(sharpImg.sharpness).toBeGreaterThan(flat.sharpness);
    expect(dark.brightness).toBeLessThan(40);
  });

  it('recorta un retrato cuadrado de 1024 px centrado en la cara', async () => {
    const image = await testImage({ width: 1200, height: 1600 });
    const portrait = await cropPortrait(
      image,
      { left: 450, top: 400, width: 300, height: 340, confidence: 1 },
      1200,
      1600,
    );
    const meta = await sharp(portrait).metadata();
    expect([meta.width, meta.height]).toEqual([1024, 1024]);
  });
});

describe('MockPhotoAnalyzer + evaluatePhoto', () => {
  it('una foto nítida y bien iluminada es válida', async () => {
    const analysis = await new MockPhotoAnalyzer().analyze(
      await testImage({ width: 1200, height: 1600 }),
    );
    expect(evaluatePhoto(analysis)).toEqual([]);
  });

  it('detecta foto oscura, borrosa o chica', async () => {
    const analyzer = new MockPhotoAnalyzer();
    expect(
      evaluatePhoto(
        await analyzer.analyze(
          await testImage({ width: 1200, height: 1600, brightness: 15, textured: false }),
        ),
      ),
    ).toEqual(expect.arrayContaining(['too_dark', 'blurry']));
    expect(
      evaluatePhoto(await analyzer.analyze(await testImage({ width: 300, height: 400 }))),
    ).toContain('low_resolution');
  });

  it('los tests pueden simular fotos sin cara o con varias personas', async () => {
    const image = await testImage({ width: 1200, height: 1600 });
    const noFace = new MockPhotoAnalyzer({ faces: () => [] });
    expect(evaluatePhoto(await noFace.analyze(image))).toEqual(['no_face']);
  });
});

describe('franja del texto', () => {
  it('recorta abajo o arriba la zona del texto con 5 puntos de margen', async () => {
    const page = new Uint8Array(
      await sharp({ create: { width: 300, height: 400, channels: 3, background: '#fff' } })
        .png()
        .toBuffer(),
    );
    const bottom = await sharp(await zoneStrip(page, 'bottom', 30)).metadata();
    expect([bottom.width, bottom.height]).toEqual([300, 140]);
    const whole = await sharp(await zoneStrip(page, 'top', 100)).metadata();
    expect(whole.height).toBe(400);
  });
});
