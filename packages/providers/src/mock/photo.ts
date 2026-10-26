import type { FaceBox, PhotoAnalysis, PhotoAnalyzer } from '@storynido/shared';
import sharp from 'sharp';

import { imageQuality } from '../images';

/**
 * Analizador simulado: mide de verdad tamaño, brillo y nitidez, pero supone una cara
 * centrada (no detecta caras). Los tests pueden forzar la cantidad de caras.
 */
export class MockPhotoAnalyzer implements PhotoAnalyzer {
  readonly id = 'mock';

  constructor(
    private readonly options: { faces?: (width: number, height: number) => FaceBox[] } = {},
  ) {}

  async analyze(image: Uint8Array): Promise<PhotoAnalysis> {
    const meta = await sharp(image).metadata();
    const width = meta.width;
    const height = meta.height;
    const quality = await imageQuality(image);
    const side = Math.round(Math.min(width, height) * 0.4);
    const faces = this.options.faces?.(width, height) ?? [
      {
        left: Math.round((width - side) / 2),
        top: Math.round(height * 0.25),
        width: side,
        height: side,
        confidence: 0.99,
      },
    ];
    return { width, height, faces, ...quality, inappropriate: 'very_unlikely' };
  }
}
