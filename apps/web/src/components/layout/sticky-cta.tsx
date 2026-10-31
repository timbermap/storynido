'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { useConsent } from '@/components/consent/consent-provider';
import { buttonVariants } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';

/** Landings donde se ofrece el botón fijo (el celular recibe la mayor parte del tráfico de anuncios). */
const LANDINGS = ['/', '/families', '/events', '/professionals'];

/**
 * Botón fijo abajo en el celular, para quien no tiene sesión y ya pasó el hero (reporte de
 * navegación). Espera a que se elija sobre las cookies, para no taparlas.
 */
export function StickyCta() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const { signedIn, loading } = useAuth();
  const { choice } = useConsent();
  const [past, setPast] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setPast(window.scrollY > 640);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  if (!LANDINGS.includes(pathname) || signedIn || loading || !choice || !past) return null;
  const label =
    pathname === '/events'
      ? t('createKit')
      : pathname === '/professionals'
        ? t('tryFree')
        : t('createPreview');
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgb(38_50_74/0.08)] bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
      <Link
        href="/login"
        data-track="sticky_cta"
        className={buttonVariants({ size: 'lg', className: 'w-full' })}
      >
        {label}
      </Link>
    </div>
  );
}
