import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

import { EMULATOR_HOSTS, firebaseConfig, useFirebaseEmulators } from './config';

let auth: Auth | undefined;
let db: Promise<Firestore> | undefined;

function firebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return firebaseConfig ? initializeApp(firebaseConfig) : initializeApp();
}

/**
 * Firebase Auth (solo componentes de cliente). Se inicializa sin el manejador de ventanas
 * emergentes para no descargar los scripts de Google en cada página: ese manejador se pasa
 * recién al iniciar sesión con Google o Apple.
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = initializeAuth(firebaseApp(), {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
  if (useFirebaseEmulators)
    connectAuthEmulator(auth, EMULATOR_HOSTS.auth, { disableWarnings: true });
  return auth;
}

/** Firestore se importa en diferido para no sumar su peso a las páginas públicas. */
export function getFirebaseDb(): Promise<Firestore> {
  db ??= import('firebase/firestore').then(({ connectFirestoreEmulator, getFirestore }) => {
    const instance = getFirestore(firebaseApp());
    if (useFirebaseEmulators) {
      connectFirestoreEmulator(
        instance,
        EMULATOR_HOSTS.firestore.host,
        EMULATOR_HOSTS.firestore.port,
      );
    }
    return instance;
  });
  return db;
}
