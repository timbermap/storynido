'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Una navegación interna que no termina en este tiempo muestra la ruedita. */
const SHOW_AFTER_MS = 300;
/** Si algo falla y la ruta nunca cambia, la ruedita no queda para siempre. */
const GIVE_UP_MS = 10_000;

/**
 * El link lleva a otra página de este sitio (no a otra pestaña, una descarga ni un ancla). Se mira
 * en la fase de captura: el `Link` de Next cancela el clic nativo para navegar por su cuenta.
 */
function isPageNavigation(event: MouseEvent): boolean {
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(link instanceof HTMLAnchorElement)) return false;
  if (link.target && link.target !== '_self') return false;
  if (link.hasAttribute('download')) return false;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname;
}

/**
 * Ruedita en el centro mientras carga otra página del sitio. Solo en las navegaciones dentro de la
 * web (al tocar un link) y recién a los 300 ms: una carga rápida no parpadea. No usa
 * `loading.tsx`, que hacía que cada página se transmitiera detrás de un estado de carga.
 */
export function NavigationSpinner() {
  const t = useTranslations('Loading');
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isPageNavigation(event)) setPending(true);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // La página nueva ya está: se apaga.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    if (!pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    const show = setTimeout(() => {
      setVisible(true);
    }, SHOW_AFTER_MS);
    const giveUp = setTimeout(() => {
      setPending(false);
    }, GIVE_UP_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(giveUp);
    };
  }, [pending]);

  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="page-loading pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background/60"
    >
      <span className="grid justify-items-center gap-3 rounded-2xl bg-card px-6 py-5 text-sm font-semibold text-muted-foreground shadow-[var(--shadow-card)]">
        <Loader2 className="size-9 animate-spin text-primary" aria-hidden="true" />
        {t('text')}
      </span>
    </div>
  );
}
