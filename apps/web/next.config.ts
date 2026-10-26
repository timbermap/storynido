import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

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
};

export default nextConfig;
