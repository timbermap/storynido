import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { brand } from '@/lib/brand';

import { Providers } from './providers';

import './globals.css';

export const metadata: Metadata = {
  title: brand.name,
  description: 'Cuentos infantiles personalizados donde tu hijo es el protagonista.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
