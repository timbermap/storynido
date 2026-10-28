import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import type { AppCheck } from 'firebase/app-check';
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

/** reCAPTCHA Enterprise para App Check (sin clave, App Check queda apagado). */
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

let appCheck: Promise<AppCheck | null> | undefined;

/**
 * Token de App Check para las rutas sensibles de la API (subir fotos, generar la muestra,
 * pagar). Se carga en diferido y solo si hay clave de reCAPTCHA Enterprise.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!RECAPTCHA_SITE_KEY || useFirebaseEmulators || typeof window === 'undefined') return null;
  appCheck ??= import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) =>
      initializeAppCheck(firebaseApp(), {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      }),
    )
    .catch(() => null);
  const instance = await appCheck;
  if (!instance) return null;
  try {
    const { getToken } = await import('firebase/app-check');
    return (await getToken(instance)).token;
  } catch {
    // Sin token, la API responde app_check_failed solo donde lo exige.
    return null;
  }
}
