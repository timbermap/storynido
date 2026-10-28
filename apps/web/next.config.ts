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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@storynido/shared'],
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // Cabeceras de seguridad en todas las páginas (DECISIONS 089).
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: securityHeaders({
          apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
          dev: process.env.NODE_ENV !== 'production',
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
