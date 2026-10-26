import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { FaceBox, Likelihood, PhotoAnalysis, PhotoAnalyzer } from '@storynido/shared';
import sharp from 'sharp';

import { imageQuality } from '../images';

const LIKELIHOODS: Record<string, Likelihood> = {
  VERY_UNLIKELY: 'very_unlikely',
  UNLIKELY: 'unlikely',
  POSSIBLE: 'possible',
  LIKELY: 'likely',
  VERY_LIKELY: 'very_likely',
};
const ORDER: Likelihood[] = [
  'unknown',
  'very_unlikely',
  'unlikely',
  'possible',
  'likely',
  'very_likely',
];

function likelihood(value: unknown): Likelihood {
  return typeof value === 'string' ? (LIKELIHOODS[value] ?? 'unknown') : 'unknown';
}

/**
 * Cloud Vision: detección de caras y de contenido inapropiado (desnudez y violencia).
 * Brillo y nitidez se miden localmente. Costo: por imagen (ver docs/SETUP.md).
 */
export class VisionPhotoAnalyzer implements PhotoAnalyzer {
  readonly id = 'vision';
  private readonly client = new ImageAnnotatorClient();

  async analyze(image: Uint8Array): Promise<PhotoAnalysis> {
    const [meta, quality, [result]] = await Promise.all([
      sharp(image).metadata(),
      imageQuality(image),
      this.client.annotateImage({
        image: { content: Buffer.from(image) },
        features: [{ type: 'FACE_DETECTION', maxResults: 5 }, { type: 'SAFE_SEARCH_DETECTION' }],
      }),
    ]);

    const faces: FaceBox[] = (result.faceAnnotations ?? []).map((face) => {
      const xs = (face.fdBoundingPoly?.vertices ?? face.boundingPoly?.vertices ?? []).map(
        (v) => v.x ?? 0,
      );
      const ys = (face.fdBoundingPoly?.vertices ?? face.boundingPoly?.vertices ?? []).map(
        (v) => v.y ?? 0,
      );
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      return {
        left,
        top,
        width: Math.max(...xs) - left,
        height: Math.max(...ys) - top,
        confidence: face.detectionConfidence ?? 0,
      };
    });

    const safe = result.safeSearchAnnotation;
    const worst = [likelihood(safe?.adult), likelihood(safe?.violence)].sort(
      (a, b) => ORDER.indexOf(b) - ORDER.indexOf(a),
    )[0];

    return {
      width: meta.width,
      height: meta.height,
      faces,
      ...quality,
      inappropriate: worst ?? 'unknown',
    };
  }
}
