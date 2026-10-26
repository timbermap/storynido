import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { createTestEnv } from './setup';

let env: RulesTestEnvironment;

const storage = (uid: string, claims: Record<string, unknown> = {}) =>
  env.authenticatedContext(uid, claims).storage() as unknown as FirebaseStorage;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

describe('storage', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff]);

  it('un cliente no sube fotos directo (solo con URL firmada de la API)', async () => {
    await assertFails(uploadBytes(ref(storage('alice'), 'photos/alice/foto.jpg'), bytes));
  });

  it('nadie lee assets ni PDFs directo, ni siendo admin', async () => {
    await assertFails(getBytes(ref(storage('alice'), 'pdfs/o1/libro.pdf')));
    await assertFails(getBytes(ref(storage('admin', { role: 'admin' }), 'assets/o1/p1.png')));
  });

  it('un visitante sin sesión tampoco', async () => {
    const anon = env.unauthenticatedContext().storage() as unknown as FirebaseStorage;
    await assertFails(getBytes(ref(anon, 'photos/alice/foto.jpg')));
  });
});
