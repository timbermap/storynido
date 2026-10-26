import { z } from 'zod';

import { countryCodeSchema } from '../countries';
import { localeSchema } from '../i18n';
import { photoRejectionReasonSchema } from '../providers/photo';
import { roleSchema } from '../roles';
import { timestampsSchema, uidSchema } from './common';

/** Límites compartidos con firebase/firestore.rules. */
export const CHILD_LIMITS = {
  nameMaxLength: 40,
  minAge: 0,
  maxAge: 12,
  maxLikes: 10,
  likeMaxLength: 40,
  dedicationMaxLength: 500,
  /** Mensaje o enseñanza propia que escribe el adulto. */
  customLessonMaxLength: 150,
} as const;

/** users/{uid} */
export const userSchema = timestampsSchema.extend({
  email: z.email().nullable(),
  displayName: z.string().max(100).nullable(),
  photoURL: z.url().nullable(),
  locale: localeSchema,
  country: countryCodeSchema,
  marketingOptIn: z.boolean(),
  /** Espejo del custom claim; solo lo escribe el servidor. */
  role: roleSchema.optional(),
});

export type User = z.infer<typeof userSchema>;

export const PRONOUNS = ['she', 'he', 'they'] as const;

/** children/{childId}: perfil del chico, protagonista del libro. */
export const childSchema = timestampsSchema.extend({
  ownerUid: uidSchema,
  name: z.string().trim().min(1).max(CHILD_LIMITS.nameMaxLength),
  age: z.number().int().min(CHILD_LIMITS.minAge).max(CHILD_LIMITS.maxAge),
  pronouns: z.enum(PRONOUNS).nullable(),
  likes: z
    .array(z.string().trim().min(1).max(CHILD_LIMITS.likeMaxLength))
    .max(CHILD_LIMITS.maxLikes),
  petName: z.string().trim().max(CHILD_LIMITS.nameMaxLength).nullable(),
  bestFriendName: z.string().trim().max(CHILD_LIMITS.nameMaxLength).nullable(),
});

export type Child = z.infer<typeof childSchema>;

/** pending_upload → (subida) → valid | rejected. Al borrarse, el documento se elimina. */
export const PHOTO_STATUSES = ['pending_upload', 'valid', 'rejected'] as const;

/** photos/{photoId}: metadatos; el archivo vive en el bucket de fotos. Solo servidor. */
export const photoSchema = timestampsSchema.extend({
  ownerUid: uidSchema,
  bookId: z.string().min(1),
  childId: z.string().min(1),
  contentType: z.string(),
  storagePath: z.string().min(1),
  processedPath: z.string().min(1).nullable(),
  status: z.enum(PHOTO_STATUSES),
  rejectionReasons: z.array(photoRejectionReasonSchema),
  consentId: z.string().min(1),
  /** Borrado automático a los 30 días (regla de ciclo de vida del bucket). */
  expiresAt: z.date(),
});

export type Photo = z.infer<typeof photoSchema>;

export const CONSENT_TYPES = ['photo_upload', 'terms', 'privacy', 'marketing'] as const;

/** consents/{consentId}: registro inmutable de consentimientos. Solo servidor. */
export const consentSchema = z.object({
  ownerUid: uidSchema,
  type: z.enum(CONSENT_TYPES),
  textVersion: z.string().min(1),
  locale: localeSchema,
  acceptedAt: z.date(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
});

export type Consent = z.infer<typeof consentSchema>;
