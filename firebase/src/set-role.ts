/**
 * Asigna un rol (custom claim) a un usuario existente y lo registra en auditLog.
 *
 *   tsx src/set-role.ts --email vos@ejemplo.com --role superadmin [--project storynido-staging]
 */
import os from 'node:os';
import { parseArgs } from 'node:util';

import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS, roleFromClaims, roleSchema } from '@storynido/shared';

import { initAdmin, isUsingEmulators } from './admin';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    role: { type: 'string' },
    project: { type: 'string' },
  },
});

if (!values.email || !values.role) {
  console.error(
    'Uso: set-role --email <email> --role <customer|admin|superadmin> [--project <id>]',
  );
  process.exit(1);
}

const role = roleSchema.parse(values.role);
const app = initAdmin(values.project);
const auth = getAuth(app);
const db = getFirestore(app);

const user = await auth.getUserByEmail(values.email);
const previousRole = roleFromClaims(user.customClaims);
const claims = { ...user.customClaims, role };

await auth.setCustomUserClaims(user.uid, claims);

const batch = db.batch();
batch.set(
  db.collection(COLLECTIONS.users).doc(user.uid),
  { role, updatedAt: FieldValue.serverTimestamp() },
  { merge: true },
);
batch.create(db.collection(COLLECTIONS.auditLog).doc(), {
  actorUid: null,
  actorEmail: `cli:${os.userInfo().username}`,
  action: 'user.set_role',
  entity: COLLECTIONS.users,
  entityId: user.uid,
  before: { role: previousRole },
  after: { role },
  at: FieldValue.serverTimestamp(),
});
await batch.commit();

const target = isUsingEmulators() ? 'emuladores' : values.project;
console.info(
  `${values.email}: ${previousRole} → ${role} (${target}). Se aplica al renovar el token.`,
);
