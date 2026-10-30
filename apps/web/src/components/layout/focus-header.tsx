'use client';

import { ArrowLeft, CircleHelp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';

import { Logo } from './logo';

/** Rutas donde se está creando o pagando: sin links de marketing que saquen del flujo. */
const FOCUS_PREFIXES = ['/create', '/new', '/checkout'];

export function isFocusPath(pathname: string): boolean {
  return FOCUS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Encabezado en "modo foco" (nuevo flujo, PR 4): volver guardando, el logo y ayuda. La etapa,
 * la línea y el estado de guardado los muestra el propio creador.
 */
export function HeaderSwitch({ children }: { children: ReactNode }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  if (!isFocusPath(pathname)) return children;
  const choosing = pathname === '/new';
  return (
    <header className="sticky top-0 z-30 border-b border-[rgb(38_50_74/0.06)] bg-background/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        {/* Cada paso se guarda al avanzar: salir no pierde nada de lo ya guardado. En /nuevo
            todavía no hay nada que guardar: solo volver. */}
        <Link
          href={choosing ? '/' : '/my-stories'}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {choosing ? t('back') : t('saveAndExit')}
        </Link>
        <span className="hidden sm:block" aria-hidden="true">
          <Logo />
        </span>
        <Link
          href="/faq"
          target="_blank"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-primary"
        >
          <CircleHelp className="size-4" aria-hidden="true" />
          {t('help')}
        </Link>
      </div>
    </header>
  );
}
