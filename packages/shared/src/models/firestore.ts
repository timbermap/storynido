import type { z } from 'zod';

interface SnapshotLike {
  data(): unknown;
}

interface TimestampLike {
  toDate(): Date;
}

function isTimestampLike(value: object): value is TimestampLike {
  return 'toDate' in value && typeof value.toDate === 'function';
}

/** Convierte recursivamente los Timestamp de Firestore (cliente o admin) en Date. */
export function normalizeFirestoreData(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (isTimestampLike(value)) return value.toDate();
  if (Array.isArray(value)) return value.map(normalizeFirestoreData);
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, normalizeFirestoreData(inner)]),
  );
}

/**
 * Converter tipado compatible con `withConverter` del SDK web y de firebase-admin.
 * Al leer valida con Zod; al escribir no transforma, para permitir FieldValue
 * (serverTimestamp, increment). Validá antes de escribir con `schema.parse`.
 */
export function createConverter<S extends z.ZodType<Record<string, unknown>>>(schema: S) {
  return {
    toFirestore(data: z.infer<S>): Record<string, unknown> {
      return data;
    },
    fromFirestore(snapshot: SnapshotLike): z.infer<S> {
      return schema.parse(normalizeFirestoreData(snapshot.data()));
    },
  };
}
