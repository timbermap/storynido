import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { brand } from '@/lib/brand';

import './globals.css';

export const metadata: Metadata = {
  title: `${brand.name} · Admin`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
