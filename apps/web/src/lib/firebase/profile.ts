import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

import { COLLECTIONS, type CountryCode, type Locale } from '@storynido/shared';

/**
 * Crea el perfil del usuario en Firestore la primera vez que inicia sesión (devuelve si lo
 * creó). Las reglas solo permiten estos campos; el rol lo asigna el servidor.
 */
export async function ensureUserProfile(
  db: Firestore,
  user: User,
  preferences: { locale: Locale; country: CountryCode },
): Promise<boolean> {
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return false;

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
  return true;
}

/** Idioma preferido de la cuenta (lo cambia el propio usuario desde "Mi cuenta"). */
export async function updateUserLocale(db: Firestore, uid: string, locale: Locale): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.users, uid), { locale, updatedAt: serverTimestamp() });
}

/** Novedades por correo (sugerencias, recordatorios y pedidos de opinión), en vivo. */
export function subscribeMarketingOptIn(
  db: Firestore,
  uid: string,
  onChange: (optIn: boolean) => void,
): () => void {
  return onSnapshot(doc(db, COLLECTIONS.users, uid), (snapshot) => {
    onChange(snapshot.get('marketingOptIn') === true);
  });
}

export async function updateMarketingOptIn(db: Firestore, uid: string, optIn: boolean) {
  await updateDoc(doc(db, COLLECTIONS.users, uid), {
    marketingOptIn: optIn,
    updatedAt: serverTimestamp(),
  });
}
