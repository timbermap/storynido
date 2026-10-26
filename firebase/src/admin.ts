import { applicationDefault, initializeApp, type App } from 'firebase-admin/app';

export function isUsingEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

/**
 * Inicializa el Admin SDK. En los emuladores usa el proyecto demo; contra la nube
 * exige el proyecto explícito y usa las credenciales de `gcloud auth application-default login`.
 */
export function initAdmin(projectId: string | undefined): App {
  if (isUsingEmulators()) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-storynido' });
  }
  if (!projectId) {
    throw new Error('Fuera de los emuladores hay que indicar --project explícitamente.');
  }
  if (projectId.startsWith('timbermap')) {
    throw new Error(
      `Proyecto "${projectId}" rechazado: StoryNido nunca opera sobre proyectos de Timbermap.`,
    );
  }
  return initializeApp({ projectId, credential: applicationDefault() });
}
