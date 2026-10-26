import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Páginas privadas: fuera de los buscadores. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return children;
}
