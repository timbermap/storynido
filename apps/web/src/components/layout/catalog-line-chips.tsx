'use client';

import { useTranslations } from 'next-intl';

import { useAuth } from '@/components/auth/auth-provider';
import { Link, usePathname } from '@/i18n/navigation';
import { AUDIENCE_TONES } from '@/lib/audience-tones';
import { cn } from '@/lib/utils';

import { CATALOG_LINES, isLinePath } from './app-nav';

/**
 * Chips de las tres líneas arriba de cada catálogo, solo en el celular y con sesión: reemplazan
 * los tres links del navbar de escritorio para pasar de un catálogo a otro.
 */
export function CatalogLineChips() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const { signedIn } = useAuth();
  if (!signedIn) return null;
  return (
    <nav aria-label={t('catalogLines')} className="container-page pt-4 lg:hidden">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {CATALOG_LINES.map(({ line, href, prefix }) => {
          const current = isLinePath(pathname, prefix);
          return (
            <li key={line} className="shrink-0">
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  current
                    ? cn(
                        'border-transparent',
                        AUDIENCE_TONES[line].panel,
                        AUDIENCE_TONES[line].text,
                      )
                    : 'border-[rgb(38_50_74/0.12)] bg-card text-foreground/80',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-2 rounded-full', AUDIENCE_TONES[line].dot)}
                />
                {t(line)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
