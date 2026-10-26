import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

import { EMULATOR_HOSTS, firebaseConfig, useFirebaseEmulators } from './config';

interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let client: FirebaseClient | undefined;

/** Instancia única del SDK web de Firebase. Solo para componentes de cliente. */
export function getFirebase(): FirebaseClient {
  if (client) return client;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (useFirebaseEmulators) {
    connectAuthEmulator(auth, EMULATOR_HOSTS.auth, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOSTS.firestore.host, EMULATOR_HOSTS.firestore.port);
  }

  client = { app, auth, db };
  return client;
}
