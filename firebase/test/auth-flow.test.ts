/**
 * Flujo real de login contra los emuladores (Auth + Firestore con las reglas del repo):
 * enlace mágico → sesión → perfil creado por el cliente → rol asignado por el servidor.
 */
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, describe, expect, it } from 'vitest';

import { roleFromClaims } from '@storynido/shared';

import { PROJECT_ID, emulatorHost } from './setup';

const authEmulator = emulatorHost('FIREBASE_AUTH_EMULATOR_HOST');
const firestoreEmulator = emulatorHost('FIRESTORE_EMULATOR_HOST');
const authUrl = `http://${authEmulator.host}:${String(authEmulator.port)}`;

const app = initializeApp(
  { apiKey: 'demo-api-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` },
  `auth-flow-${Date.now()}`,
);
const auth = getAuth(app);
connectAuthEmulator(auth, authUrl, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, firestoreEmulator.host, firestoreEmulator.port);

const adminAuth = getAdminAuth(
  initializeAdminApp({ projectId: PROJECT_ID }, `admin-${Date.now()}`),
);

interface OobCode {
  email: string;
  oobLink: string;
  requestType: string;
}

async function latestSignInLink(email: string): Promise<string> {
  const res = await fetch(`${authUrl}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
  const link = oobCodes
    .filter((c) => c.email === email && c.requestType === 'EMAIL_SIGNIN')
    .at(-1)?.oobLink;
  if (!link) throw new Error(`No hay enlace para ${email}`);
  return link;
}

afterAll(async () => {
  await signOut(auth);
  await deleteApp(app);
});

describe('login sin contraseña', () => {
  const email = `flujo-${Date.now()}@storynido.test`;

  it('el enlace mágico inicia sesión y el usuario crea su perfil', async () => {
    await sendSignInLinkToEmail(auth, email, {
      url: 'http://localhost:3000/login/finish',
      handleCodeInApp: true,
    });
    const credential = await signInWithEmailLink(auth, email, await latestSignInLink(email));
    const { uid } = credential.user;

    await setDoc(doc(db, 'users', uid), {
      email,
      displayName: null,
      photoURL: null,
      locale: 'es',
      country: 'MX',
      marketingOptIn: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    expect((await getDoc(doc(db, 'users', uid))).data()?.email).toBe(email);

    const token = await credential.user.getIdTokenResult();
    expect(roleFromClaims(token.claims)).toBe('customer');
  });

  it('el usuario no puede darse un rol, pero el servidor sí', async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('sin sesión');

    await expect(
      updateDoc(doc(db, 'users', user.uid), { role: 'admin', updatedAt: serverTimestamp() }),
    ).rejects.toThrow(/permission/i);

    await adminAuth.setCustomUserClaims(user.uid, { role: 'admin' });
    const refreshed = await user.getIdTokenResult(true);
    expect(roleFromClaims(refreshed.claims)).toBe('admin');
  });
});
