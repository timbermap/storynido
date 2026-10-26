import {
  GoogleAuthProvider,
  OAuthProvider,
  browserPopupRedirectResolver,
  isSignInWithEmailLink,
  linkWithPopup,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type AuthCredential,
  type AuthProvider,
} from 'firebase/auth';

import { api } from '../api';
import { getFirebaseAuth } from './client';

const EMAIL_FOR_SIGN_IN_KEY = 'storynido:emailForSignIn';
const RETURN_TO_KEY = 'storynido:returnTo';

/**
 * Sesión anónima para crear sin cuenta: el borrador queda a nombre de un usuario temporal
 * que se vincula a la cuenta real cuando la persona inicia sesión.
 */
export async function startAnonymousSession(): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}

/**
 * Si la cuenta ya existía, se entra con ella y la API le pasa los borradores de la sesión
 * anónima (que después se borra).
 */
async function signInAndMerge(anonymousToken: string, signIn: () => Promise<unknown>) {
  await signIn();
  await api('mergeAnonymous', { body: { anonymousIdToken: anonymousToken } });
}

const ALREADY_IN_USE = new Set(['auth/credential-already-in-use', 'auth/email-already-in-use']);

/** Entra con un proveedor; con sesión anónima la vincula para no perder el borrador. */
async function signInWithProvider(
  provider: AuthProvider,
  credentialFromError: (error: never) => AuthCredential | null,
): Promise<void> {
  const auth = getFirebaseAuth();
  const current = auth.currentUser;
  if (!current?.isAnonymous) {
    await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    return;
  }
  try {
    await linkWithPopup(current, provider, browserPopupRedirectResolver);
  } catch (error) {
    const credential = ALREADY_IN_USE.has(errorCode(error))
      ? credentialFromError(error as never)
      : null;
    if (!credential) throw error;
    const anonymousToken = await current.getIdToken();
    await signInAndMerge(anonymousToken, () => signInWithCredential(auth, credential));
  }
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithProvider(provider, (error) => GoogleAuthProvider.credentialFromError(error));
}

export async function signInWithApple(): Promise<void> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  await signInWithProvider(provider, (error) => OAuthProvider.credentialFromError(error));
}

/** Envía el enlace mágico. El email se recuerda en este navegador para completar el login. */
export async function sendMagicLink(email: string, finishPath: string): Promise<void> {
  await sendSignInLinkToEmail(getFirebaseAuth(), email, {
    url: `${window.location.origin}${finishPath}`,
    handleCodeInApp: true,
  });
  try {
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
    window.localStorage.setItem(RETURN_TO_KEY, window.location.pathname + window.location.search);
  } catch {
    // Sin storage (modo privado): se le pide el email al volver.
  }
}

export function isMagicLink(url: string): boolean {
  return isSignInWithEmailLink(getFirebaseAuth(), url);
}

export function rememberedEmail(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  } catch {
    return null;
  }
}

export async function completeMagicLink(email: string, url: string): Promise<void> {
  const auth = getFirebaseAuth();
  // La sesión anónima se restaura de forma asíncrona: hay que esperarla para vincularla.
  await auth.authStateReady();
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    // No se vincula: si el mail ya tenía cuenta, el intento fallido consume el código del
    // enlace. Se entra con el enlace (cuenta nueva o existente) y se traspasa lo anónimo.
    const anonymousToken = await current.getIdToken();
    await signInAndMerge(anonymousToken, () => signInWithEmailLink(auth, email, url));
  } else {
    await signInWithEmailLink(auth, email, url);
  }
  try {
    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  } catch {
    // Nada que limpiar.
  }
}

/** Ruta interna donde estaba el usuario al pedir el enlace (null si no hay o no es segura). */
export function takeReturnPath(): string | null {
  try {
    const path = window.localStorage.getItem(RETURN_TO_KEY);
    window.localStorage.removeItem(RETURN_TO_KEY);
    return path?.startsWith('/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}

export async function logOut(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export type AuthErrorKey =
  | 'popupClosed'
  | 'popupBlocked'
  | 'invalidEmail'
  | 'expiredLink'
  | 'accountExists'
  | 'network'
  | 'providerDisabled'
  | 'generic';

/** Clave de mensaje (Auth.errors.*) para los errores más comunes de Firebase Auth. */
export function authErrorKey(error: unknown): AuthErrorKey {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'popupClosed';
    case 'auth/popup-blocked':
      return 'popupBlocked';
    case 'auth/invalid-email':
      return 'invalidEmail';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'expiredLink';
    case 'auth/account-exists-with-different-credential':
      return 'accountExists';
    case 'auth/network-request-failed':
      return 'network';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'providerDisabled';
    default:
      return 'generic';
  }
}
