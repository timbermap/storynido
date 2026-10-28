import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

import { securityHeaders } from './src/lib/security-headers';

// Todas las apps y servicios comparten el `.env.local` de la raíz del monorepo.
// `forceReload` porque Next ya cargó (y cacheó) los .env del directorio de la app.
loadEnvConfig(
  path.resolve(process.cwd(), '../..'),
  process.env.NODE_ENV !== 'production',
  undefined,
  true,
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@storynido/shared'],
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
          analytics: false,
        }),
      },
    ]),
};

export default nextConfig;
