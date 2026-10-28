/**
 * Cabeceras de seguridad (fase 16, DECISIONS 089). La CSP permite solo lo que la app usa:
 * Firebase (Auth, Firestore, App Check con reCAPTCHA Enterprise), la API, Cloud Storage
 * (URLs firmadas) y, en la web, la analítica que se carga con consentimiento.
 *
 * `script-src` mantiene 'unsafe-inline': Next genera scripts en línea en las páginas estáticas
 * y un nonce obligaría a renderizar todo en cada request. Lo compensan `object-src 'none'`,
 * `base-uri 'self'`, la lista cerrada de orígenes y React (que escapa todo lo que muestra).
 */
export interface SecurityOptions {
  apiUrl: string;
  dev: boolean;
  /** Analítica con consentimiento (GA4 y Meta): solo la web. */
  analytics: boolean;
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

export function contentSecurityPolicy({ apiUrl, dev, analytics }: SecurityOptions): string {
  const api = new URL(apiUrl).origin;
  const firebase = [
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'https://*.firebaseapp.com',
    'https://*.hosted.app',
  ];
  const recaptcha = ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'];
  const ga = ['https://www.googletagmanager.com', 'https://*.google-analytics.com'];
  const meta = ['https://connect.facebook.net', 'https://www.facebook.com'];
  // En desarrollo: recarga en caliente de Next y los emuladores de Firebase.
  const local = dev ? ['http://localhost:*', 'http://127.0.0.1:*', 'ws://localhost:*'] : [];
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': unique([
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      'https://apis.google.com',
      ...recaptcha,
      ...(analytics ? [...ga, 'https://connect.facebook.net'] : []),
    ]),
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': unique([
      "'self'",
      'data:',
      'blob:',
      api,
      'https://storage.googleapis.com',
      'https://lh3.googleusercontent.com',
      ...(analytics ? [...ga, 'https://www.facebook.com'] : []),
      ...local,
    ]),
    'font-src': ["'self'", 'data:'],
    'connect-src': unique([
      "'self'",
      api,
      'https://storage.googleapis.com',
      ...firebase,
      ...recaptcha,
      ...(analytics ? [...ga, ...meta] : []),
      ...local,
    ]),
    'frame-src': unique([
      'https://*.firebaseapp.com',
      'https://*.hosted.app',
      'https://accounts.google.com',
      'https://appleid.apple.com',
      ...recaptcha,
      'https://recaptcha.google.com',
      ...(analytics ? ['https://www.facebook.com'] : []),
      ...local,
    ]),
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    ...(dev ? {} : { 'upgrade-insecure-requests': [] }),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}

export function securityHeaders(options: SecurityOptions) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(options) },
    // Dos años, con subdominios: el sitio es solo HTTPS.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Los popups de Google y Apple necesitan comunicarse con la ventana que los abrió.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
  ];
}
