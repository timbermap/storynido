import { createApiClient } from '@storynido/shared';

import { getFirebaseAuth } from './firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

/** Cliente tipado de la API con el token de la sesión del admin. */
export const api = createApiClient({
  baseUrl: API_URL,
  getIdToken: async () => (await getFirebaseAuth().currentUser?.getIdToken()) ?? null,
});
