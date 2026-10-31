import {
  GoogleAuthProvider,
  OAuthProvider,
  TotpMultiFactorGenerator,
  browserPopupRedirectResolver,
  getMultiFactorResolver,
  getRedirectResult,
  isSignInWithEmailLink,
  linkWithPopup,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthCredential,
  type AuthProvider,
  type MultiFactorError,
  type MultiFactorResolver,
} from 'firebase/auth';

import { api } from '../api';
import { getFirebaseAuth } from './client';

const EMAIL_FOR_SIGN_IN_KEY = 'storynido:emailForSignIn';
const RETURN_TO_KEY = 'storynido:returnTo';

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

/**
 * Navegadores integrados (Instagram, Facebook, WhatsApp, TikTok…): no abren popups o los pierden,
 * y de ahí llega buena parte del tráfico pago. Ahí se entra por redirección.
 */
export function isEmbeddedBrowser(userAgent = navigator.userAgent): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|TikTok|musical_ly|Snapchat|Twitter/i.test(
    userAgent,
  );
}

/** Popup bloqueado o no soportado: se reintenta por redirección. */
const POPUP_FAILED = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

type LoginMethod = 'google' | 'apple' | 'email';
type LoginVia = 'popup' | 'redirect' | 'link';
const LOGIN_METHOD_KEY = 'storynido:loginMethod';

/**
 * Cuenta un paso del login (contadores del servidor por navegador, método y vía; sin datos de
 * la persona). Nunca frena el login: si falla, se ignora.
 */
function reportLogin(
  stage: 'started' | 'succeeded' | 'failed',
  method: LoginMethod,
  via: LoginVia,
) {
  void api('loginEvent', {
    body: { stage, method, via, browser: isEmbeddedBrowser() ? 'embedded' : 'standard' },
  }).catch(() => undefined);
}

/** Un error que no es un fracaso del login: falta el segundo factor (sigue en el panel). */
const isMfaStep = (error: unknown) => errorCode(error) === 'auth/multi-factor-auth-required';

/** Redirección: se recuerda dónde estaba para volver ahí (la completa completeRedirectSignIn). */
async function signInByRedirect(provider: AuthProvider, method: LoginMethod): Promise<void> {
  rememberReturnPath();
  try {
    window.sessionStorage.setItem(LOGIN_METHOD_KEY, method);
  } catch {
    // Sin storage, la vuelta no se cuenta.
  }
  reportLogin('started', method, 'redirect');
  await signInWithRedirect(getFirebaseAuth(), provider, browserPopupRedirectResolver);
}

/** Método del login por redirección en curso (y lo olvida). */
function takeRedirectMethod(): LoginMethod | null {
  try {
    const method = window.sessionStorage.getItem(LOGIN_METHOD_KEY);
    window.sessionStorage.removeItem(LOGIN_METHOD_KEY);
    return method === 'google' || method === 'apple' ? method : null;
  } catch {
    return null;
  }
}

/**
 * Al volver de una redirección: termina el login. Devuelve el error (por ejemplo, el de segundo
 * factor) para que el panel lo muestre; null si no había nada pendiente o salió bien.
 */
export async function completeRedirectSignIn(): Promise<unknown> {
  try {
    const result = await getRedirectResult(getFirebaseAuth(), browserPopupRedirectResolver);
    const method = takeRedirectMethod();
    if (result && method) reportLogin('succeeded', method, 'redirect');
    return null;
  } catch (error) {
    const method = takeRedirectMethod();
    if (method && !isMfaStep(error)) reportLogin('failed', method, 'redirect');
    return error;
  }
}

/** Entra con un proveedor; con sesión anónima la vincula para no perder el borrador. */
async function signInWithProvider(
  provider: AuthProvider,
  credentialFromError: (error: never) => AuthCredential | null,
  method: LoginMethod,
): Promise<void> {
  const auth = getFirebaseAuth();
  const current = auth.currentUser;
  if (!current?.isAnonymous) {
    if (isEmbeddedBrowser()) {
      await signInByRedirect(provider, method);
      return;
    }
    reportLogin('started', method, 'popup');
    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      reportLogin('succeeded', method, 'popup');
    } catch (error) {
      if (!isMfaStep(error)) reportLogin('failed', method, 'popup');
      if (!POPUP_FAILED.has(errorCode(error))) throw error;
      await signInByRedirect(provider, method);
    }
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
  await signInWithProvider(
    provider,
    (error) => GoogleAuthProvider.credentialFromError(error),
    'google',
  );
}

/**
 * Cuentas con segundo factor (el equipo, que también entra al admin): el login devuelve
 * `auth/multi-factor-auth-required` y se completa con el código de la app autenticadora.
 */
export function multiFactorResolver(error: unknown): MultiFactorResolver | null {
  if (errorCode(error) !== 'auth/multi-factor-auth-required') return null;
  return getMultiFactorResolver(getFirebaseAuth(), error as MultiFactorError);
}

/** Completa el login con el código TOTP. Falla con `auth/invalid-verification-code` si no vale. */
export async function resolveWithTotp(resolver: MultiFactorResolver, code: string): Promise<void> {
  const hint = resolver.hints.find((item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) throw Object.assign(new Error('Sin app autenticadora'), { code: 'auth/mfa-no-totp' });
  await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code));
}

export async function signInWithApple(): Promise<void> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  await signInWithProvider(provider, (error) => OAuthProvider.credentialFromError(error), 'apple');
}

/** Envía el enlace mágico. El email se recuerda en este navegador para completar el login. */
export async function sendMagicLink(email: string, finishPath: string): Promise<void> {
  await sendSignInLinkToEmail(getFirebaseAuth(), email, {
    url: `${window.location.origin}${finishPath}`,
    handleCodeInApp: true,
  });
  reportLogin('started', 'email', 'link');
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
  try {
    if (current?.isAnonymous) {
      // No se vincula: si el mail ya tenía cuenta, el intento fallido consume el código del
      // enlace. Se entra con el enlace (cuenta nueva o existente) y se traspasa lo anónimo.
      const anonymousToken = await current.getIdToken();
      await signInAndMerge(anonymousToken, () => signInWithEmailLink(auth, email, url));
    } else {
      await signInWithEmailLink(auth, email, url);
    }
    reportLogin('succeeded', 'email', 'link');
  } catch (error) {
    reportLogin('failed', 'email', 'link');
    throw error;
  }
  try {
    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  } catch {
    // Nada que limpiar.
  }
}

/** Guarda dónde está el usuario, para volver ahí después del enlace o la redirección. */
function rememberReturnPath(): void {
  try {
    window.localStorage.setItem(RETURN_TO_KEY, window.location.pathname + window.location.search);
  } catch {
    // Sin storage: se vuelve a Mis cuentos.
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

/** Pago y pedido: lo único a lo que se vuelve tras entrar (todo lo demás cae en Mis cuentos). */
const KEEP_RETURN = /\/(pagar|checkout|pagamento|pedido|order)\//;

/**
 * Adónde se va después de entrar (DECISIONS 152): siempre a Mis cuentos, la página de quien ya es
 * cliente, donde ve qué hacer y cuál es el botón de crear. Solo se respeta volver a un pago o a un
 * pedido; la ruta guardada se borra en todos los casos.
 */
export function afterLoginPath(requested?: string | null): string | null {
  const saved = takeReturnPath();
  const candidate = [requested, saved].find(
    (path): path is string =>
      Boolean(path?.startsWith('/')) && !path?.startsWith('//') && KEEP_RETURN.test(path ?? ''),
  );
  return candidate ?? null;
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
  | 'mfaInvalid'
  | 'mfaUnsupported'
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
    case 'auth/invalid-verification-code':
    case 'auth/totp-challenge-timeout':
      return 'mfaInvalid';
    case 'auth/mfa-no-totp':
      return 'mfaUnsupported';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'providerDisabled';
    default:
      return 'generic';
  }
}
