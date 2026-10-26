import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const root = fileURLToPath(new URL('..', import.meta.url));

export const PROJECT_ID = 'demo-storynido';

export function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(`${root}/firestore.rules`, 'utf8'),
      host: '127.0.0.1',
      port: 8180,
    },
    storage: {
      rules: readFileSync(`${root}/storage.rules`, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
}
