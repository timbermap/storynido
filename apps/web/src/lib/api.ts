import { createApiClient } from '@storynido/shared';

import { getAppCheckToken, getFirebaseAuth } from './firebase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

/** Cliente tipado de la API: agrega el token de la sesión en las rutas protegidas. */
export const api = createApiClient({
  baseUrl: API_URL,
  getIdToken: async () => (await getFirebaseAuth().currentUser?.getIdToken()) ?? null,
  getAppCheckToken,
});
