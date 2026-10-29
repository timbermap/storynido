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

import {
  COLLECTIONS,
  countryCodeSchema,
  localeSchema,
  type CountryCode,
  type Locale,
} from '@storynido/shared';

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

/** Preferencias de la cuenta en vivo: novedades por correo y país. */
export function subscribePreferences(
  db: Firestore,
  uid: string,
  onChange: (preferences: { marketingOptIn: boolean; country: CountryCode | null }) => void,
): () => void {
  return onSnapshot(doc(db, COLLECTIONS.users, uid), (snapshot) => {
    const country = countryCodeSchema.safeParse(snapshot.get('country'));
    onChange({
      marketingOptIn: snapshot.get('marketingOptIn') === true,
      country: country.success ? country.data : null,
    });
  });
}

/** País de la cuenta (moneda y precios); también queda en este dispositivo. */
export async function updateUserCountry(db: Firestore, uid: string, country: CountryCode) {
  await updateDoc(doc(db, COLLECTIONS.users, uid), { country, updatedAt: serverTimestamp() });
}

/** País e idioma guardados en la cuenta, para aplicarlos en este dispositivo al iniciar sesión. */
export async function readPreferences(
  db: Firestore,
  uid: string,
): Promise<{ country: CountryCode | null; locale: Locale | null }> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.users, uid));
  const country = countryCodeSchema.safeParse(snapshot.get('country'));
  const locale = localeSchema.safeParse(snapshot.get('locale'));
  return {
    country: country.success ? country.data : null,
    locale: locale.success ? locale.data : null,
  };
}

export async function updateMarketingOptIn(db: Firestore, uid: string, optIn: boolean) {
  await updateDoc(doc(db, COLLECTIONS.users, uid), {
    marketingOptIn: optIn,
    updatedAt: serverTimestamp(),
  });
}
