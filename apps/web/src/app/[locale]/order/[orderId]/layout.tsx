import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Pantalla privada de la compra: no se indexa (la ruta queda rastreable para que Google vea el noindex). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
