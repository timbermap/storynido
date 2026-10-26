import { z } from 'zod';

/**
 * Configuración pública de Firebase (no es secreta: la protegen las reglas y App Check).
 * Los valores por defecto apuntan al proyecto local de los emuladores.
 */
const firebaseConfigSchema = z.object({
  apiKey: z.string().min(1).default('demo-api-key'),
  authDomain: z.string().min(1).default('demo-storynido.firebaseapp.com'),
  projectId: z.string().min(1).default('demo-storynido'),
  storageBucket: z.string().optional(),
  messagingSenderId: z.string().optional(),
  appId: z.string().optional(),
});

const blankToUndefined = (value: string | undefined) => (value === '' ? undefined : value);

// Next.js solo reemplaza process.env.NEXT_PUBLIC_* escritos de forma literal.
export const firebaseConfig = firebaseConfigSchema.parse({
  apiKey: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: blankToUndefined(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
});

export const useFirebaseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

export const EMULATOR_HOSTS = {
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8180 },
} as const;
