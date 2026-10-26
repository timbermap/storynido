import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Proyecto aislado de los tests (los emuladores de test los levanta with-test-emulators.sh). */
export const PROJECT_ID = 'demo-storynido-test';

/** host:puerto que exporta `firebase emulators:exec` para cada emulador. */
export function emulatorHost(variable: string): { host: string; port: number } {
  const value = process.env[variable];
  if (!value)
    throw new Error(`${variable} no está definido: corré los tests con with-test-emulators.sh`);
  const [host = '127.0.0.1', port = ''] = value.split(':');
  return { host, port: Number(port) };
}

export function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(`${root}/firestore.rules`, 'utf8'),
      ...emulatorHost('FIRESTORE_EMULATOR_HOST'),
    },
    storage: {
      rules: readFileSync(`${root}/storage.rules`, 'utf8'),
      ...emulatorHost('FIREBASE_STORAGE_EMULATOR_HOST'),
    },
  });
}
