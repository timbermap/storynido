'use client';

import { useAuth } from './auth-provider';

/** Texto de un botón según haya sesión ("Crear mi cuenta" no tiene sentido si ya entró). */
export function SignedInLabel({ guest, member }: { guest: string; member: string }) {
  const { signedIn } = useAuth();
  return <>{signedIn ? member : guest}</>;
}
