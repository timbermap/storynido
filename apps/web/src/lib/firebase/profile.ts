import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';

import { COLLECTIONS, DEFAULT_LOCALE, LOCALE_DEFINITIONS } from '@storynido/shared';

/**
 * Crea el perfil del usuario en Firestore la primera vez que inicia sesión.
 * Las reglas solo permiten estos campos; el rol lo asigna el servidor.
 */
export async function ensureUserProfile(db: Firestore, user: User): Promise<void> {
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  await setDoc(ref, {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    locale: DEFAULT_LOCALE,
    country: LOCALE_DEFINITIONS[DEFAULT_LOCALE].country,
    marketingOptIn: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
