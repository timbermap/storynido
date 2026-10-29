import type { FirebaseOptions } from 'firebase/app';

export const useFirebaseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

/** Proyecto local de los emuladores (los proyectos demo-* nunca tocan la nube). */
const EMULATOR_CONFIG: FirebaseOptions = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-storynido.firebaseapp.com',
  projectId: 'demo-storynido',
};

const blankToUndefined = (value: string | undefined) => (value === '' ? undefined : value);

// Next.js solo reemplaza process.env.NEXT_PUBLIC_* escritos de forma literal.
const explicitConfig: FirebaseOptions = {
  apiKey: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

/**
 * Configuración pública de Firebase (no es secreta: la protegen las reglas y App Check).
 * - Emuladores: proyecto demo.
 * - NEXT_PUBLIC_FIREBASE_*: valores explícitos.
 * - null: initializeApp() sin opciones; Firebase App Hosting inyecta la configuración del proyecto.
 */
/** Configuración que inyecta App Hosting (ver next.config), con el authDomain propio si lo hay. */
const hostedConfig = (() => {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG;
  if (!raw) return null;
  try {
    const config = JSON.parse(raw) as FirebaseOptions;
    return explicitConfig.authDomain
      ? { ...config, authDomain: explicitConfig.authDomain }
      : config;
  } catch {
    return null;
  }
})();

export const firebaseConfig: FirebaseOptions | null = useFirebaseEmulators
  ? EMULATOR_CONFIG
  : explicitConfig.apiKey
    ? explicitConfig
    : hostedConfig;

export const EMULATOR_HOSTS = {
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8180 },
} as const;
