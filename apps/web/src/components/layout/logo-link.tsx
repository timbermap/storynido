'use client';

import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';

/**
 * El logo lleva a la home. Si ya estás en la home, Next conserva el scroll y deja el hash
 * (por ejemplo #audience): acá se saca el hash y se sube al principio.
 */
export function LogoLink({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center rounded-xl"
      onClick={(event) => {
        if (pathname !== '/') return;
        event.preventDefault();
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      {children}
    </Link>
  );
}
