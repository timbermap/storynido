import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminAuthProvider } from '@/components/auth/admin-auth';
import { AdminGate } from '@/components/auth/admin-gate';
import { themeScript } from '@/components/shell/theme-toggle';
import { brand } from '@/lib/brand';

import './globals.css';

export const metadata: Metadata = {
  title: `${brand.name} · Admin`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AdminAuthProvider>
          <AdminGate>{children}</AdminGate>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
