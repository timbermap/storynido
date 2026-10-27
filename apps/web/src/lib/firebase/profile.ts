import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

import { COLLECTIONS, type CountryCode, type Locale } from '@storynido/shared';

/**
 * Crea el perfil del usuario en Firestore la primera vez que inicia sesión.
 * Las reglas solo permiten estos campos; el rol lo asigna el servidor.
 */
export async function ensureUserProfile(
  db: Firestore,
  user: User,
  preferences: { locale: Locale; country: CountryCode },
): Promise<void> {
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  await setDoc(ref, {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    locale: preferences.locale,
    country: preferences.country,
    marketingOptIn: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Idioma preferido de la cuenta (lo cambia el propio usuario desde "Mi cuenta"). */
export async function updateUserLocale(db: Firestore, uid: string, locale: Locale): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.users, uid), { locale, updatedAt: serverTimestamp() });
}
