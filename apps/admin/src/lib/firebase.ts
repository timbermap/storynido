import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

export const useFirebaseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

/**
 * El admin exige verificación en dos pasos (TOTP). Con los emuladores no hay segundo factor,
 * igual que la API en local; en staging se apaga hasta pasar a Identity Platform.
 */
export const mfaRequired =
  !useFirebaseEmulators && process.env.NEXT_PUBLIC_ADMIN_MFA_REQUIRED !== 'false';

const blankToUndefined = (value: string | undefined) => (value === '' ? undefined : value);

// Next.js solo reemplaza process.env.NEXT_PUBLIC_* escritos de forma literal.
const explicitConfig: FirebaseOptions = {
  apiKey: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  appId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

/** Emuladores: proyecto demo. Si no, valores explícitos o los que inyecta App Hosting. */
const firebaseConfig: FirebaseOptions | null = useFirebaseEmulators
  ? {
      apiKey: 'demo-api-key',
      authDomain: 'demo-storynido.firebaseapp.com',
      projectId: 'demo-storynido',
    }
  : explicitConfig.apiKey
    ? explicitConfig
    : null;

function firebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return firebaseConfig ? initializeApp(firebaseConfig) : initializeApp();
}

let auth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = initializeAuth(firebaseApp(), {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  if (useFirebaseEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}
