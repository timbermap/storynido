import { COLLECTIONS, type AuditLogEntry } from '@storynido/shared';
import type { Firestore, WriteBatch } from 'firebase-admin/firestore';

import type { RequestUser } from '../types';

export interface AuditChange {
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/** Quién hizo el cambio, para auditLog y el `updatedBy` de la configuración. */
export const actorLabel = (actor: RequestUser | null) => actor?.email ?? actor?.uid ?? null;

export function auditEntry(actor: RequestUser | null, change: AuditChange, at = new Date()) {
  return {
    actorUid: actor?.uid ?? null,
    actorEmail: actor?.email ?? null,
    ...change,
    at,
  } satisfies AuditLogEntry;
}

/**
 * Toda escritura del admin pasa por acá: el cambio y su registro de auditoría (quién, qué,
 * cuándo, antes y después) van en el mismo lote, así nunca queda uno sin el otro.
 */
export async function auditedWrite(
  db: Firestore,
  actor: RequestUser | null,
  change: AuditChange,
  write: (batch: WriteBatch) => void,
): Promise<void> {
  const batch = db.batch();
  write(batch);
  batch.create(db.collection(COLLECTIONS.auditLog).doc(), auditEntry(actor, change));
  await batch.commit();
}
