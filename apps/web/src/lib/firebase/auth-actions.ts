import {
  GoogleAuthProvider,
  OAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

import { getFirebase } from './client';

const EMAIL_FOR_SIGN_IN_KEY = 'storynido:emailForSignIn';

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(getFirebase().auth, provider);
}

export async function signInWithApple(): Promise<void> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  await signInWithPopup(getFirebase().auth, provider);
}

/** Envía el enlace mágico. El email se recuerda en este navegador para completar el login. */
export async function sendMagicLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(getFirebase().auth, email, {
    url: `${window.location.origin}/login/finish`,
    handleCodeInApp: true,
  });
  try {
    window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
  } catch {
    // Sin storage (modo privado): se le pide el email al volver.
  }
}

export function isMagicLink(url: string): boolean {
  return isSignInWithEmailLink(getFirebase().auth, url);
}

export function rememberedEmail(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  } catch {
    return null;
  }
}

export async function completeMagicLink(email: string, url: string): Promise<void> {
  await signInWithEmailLink(getFirebase().auth, email, url);
  try {
    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  } catch {
    // Nada que limpiar.
  }
}

export async function logOut(): Promise<void> {
  await signOut(getFirebase().auth);
}

/** Mensaje entendible para los errores más comunes de Firebase Auth. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Cerraste la ventana antes de terminar. Probá de nuevo.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de inicio de sesión. Habilitá las ventanas emergentes.';
    case 'auth/invalid-email':
      return 'Ese email no parece válido.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'El enlace venció o ya se usó. Pedí uno nuevo.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con ese email. Iniciá sesión con el método que usaste antes.';
    case 'auth/network-request-failed':
      return 'No hay conexión. Revisá tu internet y probá de nuevo.';
    default:
      return 'No pudimos iniciar sesión. Probá de nuevo en unos minutos.';
  }
}
