import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { securityHeaders } from './src/lib/security-headers';

// Todas las apps y servicios comparten el `.env.local` de la raíz del monorepo.
// `forceReload` porque Next ya cargó (y cacheó) los .env del directorio de la app.
loadEnvConfig(
  path.resolve(process.cwd(), '../..'),
  process.env.NODE_ENV !== 'production',
  undefined,
  true,
);

/**
 * Configuración web de Firebase que App Hosting inyecta en el build. Se expone al navegador para
 * poder usar el dominio propio como authDomain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN): con el de
 * firebaseapp.com, Chrome y Safari bloquean el almacenamiento entre dominios y el login con Google
 * no vuelve al sitio. /__/auth/* se reenvía al handler de Firebase del proyecto.
 */
const webappConfig = (() => {
  try {
    return JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG ?? '') as { authDomain?: string };
  } catch {
    return null;
  }
})();
const firebaseAuthHost = webappConfig?.authDomain;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: webappConfig ? { NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG: JSON.stringify(webappConfig) } : {},
  rewrites: () =>
    Promise.resolve(
      firebaseAuthHost
        ? [{ source: '/__/auth/:path*', destination: `https://${firebaseAuthHost}/__/auth/:path*` }]
        : [],
    ),
  poweredByHeader: false,
  transpilePackages: ['@storynido/shared'],
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // Base de país por IP: la lee el proxy y el servidor con fs (no la detecta el trazado solo).
  outputFileTracingIncludes: { '/*': ['./geo/*.mmdb'] },
  // Cabeceras de seguridad en todas las páginas (DECISIONS 089).
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: securityHeaders({
          apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
          // Emuladores locales (también en `next start` para los E2E): sus orígenes en la CSP.
          dev:
            process.env.NODE_ENV !== 'production' ||
            process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true',
          analytics: true,
        }),
      },
    ]),
  images: {
    // Las ilustraciones de muestra son SVG propios.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const withMDX = createMDX({
  options: { remarkPlugins: ['remark-gfm'] },
});

export default withNextIntl(withMDX(nextConfig));
