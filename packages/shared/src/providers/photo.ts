import { z } from 'zod';

/** Caja de una cara, en píxeles de la imagen analizada (orientación ya corregida). */
export interface FaceBox {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

export type Likelihood =
  'very_unlikely' | 'unlikely' | 'possible' | 'likely' | 'very_likely' | 'unknown';

export interface PhotoAnalysis {
  width: number;
  height: number;
  faces: FaceBox[];
  /** Brillo medio de 0 (negro) a 255 (blanco). */
  brightness: number;
  /** Nitidez relativa (desvío de los bordes); más alto = más nítida. */
  sharpness: number;
  /** Probabilidad de contenido inapropiado (desnudez o violencia). */
  inappropriate: Likelihood;
}

/** Analiza una foto: caras, luz, nitidez y contenido. Mock en local, Cloud Vision en la nube. */
export interface PhotoAnalyzer {
  readonly id: string;
  analyze(image: Uint8Array): Promise<PhotoAnalysis>;
}

export const PHOTO_REJECTION_REASONS = [
  'unsupported_format',
  'low_resolution',
  'no_face',
  'multiple_faces',
  'face_too_small',
  'too_dark',
  'too_bright',
  'blurry',
  'inappropriate',
] as const;

export const photoRejectionReasonSchema = z.enum(PHOTO_REJECTION_REASONS);

export type PhotoRejectionReason = z.infer<typeof photoRejectionReasonSchema>;

/** Criterios de una foto útil para ilustrar al protagonista. */
export const PHOTO_RULES = {
  maxBytes: 15 * 1024 * 1024,
  maxPhotosPerBook: 3,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  minSidePx: 512,
  /** La cara tiene que ocupar al menos este porcentaje de la imagen. */
  minFaceAreaRatio: 0.03,
  minBrightness: 45,
  maxBrightness: 235,
  minSharpness: 6,
  minFaceConfidence: 0.6,
} as const;

/** Consentimiento vigente para subir fotos (cambia si cambia el texto). */
export const PHOTO_CONSENT_VERSION = 'photo-upload-v1';
/**
 * Profesionales: declaración de que tienen la autorización de la madre, el padre o el tutor
 * del chico para usar su foto. El texto lo revisa un abogado antes del lanzamiento.
 */
export const GUARDIAN_CONSENT_VERSION = 'guardian-authorization-v1';

/** Decide si una foto sirve. Devuelve los motivos de rechazo (vacío = válida). */
export function evaluatePhoto(analysis: PhotoAnalysis): PhotoRejectionReason[] {
  const reasons: PhotoRejectionReason[] = [];
  if (analysis.inappropriate === 'likely' || analysis.inappropriate === 'very_likely') {
    return ['inappropriate'];
  }
  if (Math.min(analysis.width, analysis.height) < PHOTO_RULES.minSidePx)
    reasons.push('low_resolution');

  const faces = analysis.faces.filter((face) => face.confidence >= PHOTO_RULES.minFaceConfidence);
  if (faces.length === 0) reasons.push('no_face');
  if (faces.length > 1) reasons.push('multiple_faces');
  const [face] = faces;
  if (faces.length === 1 && face) {
    const ratio = (face.width * face.height) / (analysis.width * analysis.height);
    if (ratio < PHOTO_RULES.minFaceAreaRatio) reasons.push('face_too_small');
  }

  if (analysis.brightness < PHOTO_RULES.minBrightness) reasons.push('too_dark');
  if (analysis.brightness > PHOTO_RULES.maxBrightness) reasons.push('too_bright');
  if (analysis.sharpness < PHOTO_RULES.minSharpness) reasons.push('blurry');
  return reasons;
}
