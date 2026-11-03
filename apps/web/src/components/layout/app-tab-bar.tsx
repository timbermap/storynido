'use client';

import { BookHeart, CircleUser, House, LayoutGrid, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import type { Channel } from '@storynido/shared';

import { CHANNEL_STORAGE_KEY } from '@/components/landing/remember-channel';
import { Link, usePathname } from '@/i18n/navigation';

import { CATALOG_LINES, CreateOptions, InProgressDot, catalogHref, isLinePath } from './app-nav';
import { isFocusPath } from './focus-header';
import { useOrderCounts } from './use-account-activity';

const TAB =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold text-foreground/70 transition-colors aria-[current=page]:text-navy';

function readRememberedLine(): Channel {
  try {
    const value = window.sessionStorage.getItem(CHANNEL_STORAGE_KEY);
    return CATALOG_LINES.find((item) => item.line === value)?.line ?? 'families';
  } catch {
    // Sin storage (modo privado): Familias.
    return 'families';
  }
}

const noSubscription = () => () => undefined;

/**
 * La línea de la página actual o, si no, la última que se visitó en esta sesión del navegador
 * (RememberChannel). Se vuelve a leer en cada render: cambia al navegar.
 */
function useCatalogLine(pathname: string): Channel {
  const remembered = useSyncExternalStore<Channel>(
    noSubscription,
    readRememberedLine,
    () => 'families',
  );
  return CATALOG_LINES.find((item) => isLinePath(pathname, item.prefix))?.line ?? remembered;
}

/**
 * Barra inferior del celular para quien tiene sesión (opción 1): Inicio, Catálogo, Crear (al
 * centro), Mis cuentos y Cuenta. No aparece en los flujos de foco (crear, pagar), igual que el
 * navbar. Deja su propio alto al final de la página para no tapar el contenido.
 */
export function AppTabBar() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const orders = useOrderCounts();
  const line = useCatalogLine(pathname);
  const [creating, setCreating] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setCreating(false);
  }

  if (isFocusPath(pathname)) return null;

  const onCatalog = CATALOG_LINES.some((item) => isLinePath(pathname, item.prefix));
  const onMyStories = pathname === '/my-stories' || pathname.startsWith('/my-stories/');

  return (
    <>
      <div aria-hidden="true" className="h-[calc(4.25rem+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label={t('tabBar')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgb(38_50_74/0.08)] bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-end px-2">
          <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} className={TAB}>
            <House className="size-5" aria-hidden="true" />
            {t('home')}
          </Link>
          <Link
            href={catalogHref(line)}
            aria-current={onCatalog ? 'page' : undefined}
            className={TAB}
          >
            <LayoutGrid className="size-5" aria-hidden="true" />
            {t('catalog')}
          </Link>
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={creating}
              aria-controls="sheet-create"
              onClick={() => {
                setCreating(true);
              }}
              className="-mt-5 mb-1.5 grid size-14 place-items-center rounded-full bg-action text-action-foreground shadow-[0_10px_24px_-8px_rgb(38_50_74/0.45)] ring-4 ring-background transition-colors hover:bg-action-hover"
            >
              <Plus className="size-6" aria-hidden="true" />
              <span className="sr-only">{t('createShort')}</span>
            </button>
          </div>
          <Link href="/my-stories" aria-current={onMyStories ? 'page' : undefined} className={TAB}>
            <span className="relative">
              <BookHeart className="size-5" aria-hidden="true" />
              <InProgressDot
                count={orders?.inProgress ?? 0}
                className="absolute -top-0.5 -right-1 ring-2 ring-background"
              />
            </span>
            {t('myStories')}
          </Link>
          <Link
            href="/account"
            aria-current={pathname === '/account' ? 'page' : undefined}
            className={TAB}
          >
            <CircleUser className="size-5" aria-hidden="true" />
            {t('accountShort')}
          </Link>
        </div>
      </nav>
      {creating && (
        <BottomSheet
          id="sheet-create"
          title={t('createTitle')}
          closeLabel={t('close')}
          onClose={() => {
            setCreating(false);
          }}
        >
          <CreateOptions />
        </BottomSheet>
      )}
    </>
  );
}

/** Hoja que sube desde abajo: se cierra con Escape, tocando afuera o con la X. */
function BottomSheet({
  id,
  title,
  closeLabel,
  onClose,
  children,
}: {
  id: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // La última versión de onClose, sin volver a enfocar la hoja en cada render del padre.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-navy/30"
      />
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-24px_60px_-12px_rgb(38_50_74/0.22)] outline-none"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full text-foreground/70 hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">{closeLabel}</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
