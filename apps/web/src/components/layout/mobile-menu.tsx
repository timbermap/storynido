'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { usePathname } from '@/i18n/navigation';

/** Menú desplegable en pantallas chicas; se cierra al navegar o con Escape. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const t = useTranslations('Nav');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t('closeMenu') : t('menu')}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {open ? <X /> : <Menu />}
      </Button>
      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b bg-background px-4 pt-2 pb-6 shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}
