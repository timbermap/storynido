'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { HomeChannel } from '@/lib/home-state';
import { cn } from '@/lib/utils';

import { LINE_IMAGES, LineChip, cardClass, type LineCopy } from './parts';

/**
 * «Crear algo nuevo»: las tres líneas. Sin nada pendiente, la que manda lleva el borde
 * y el botón durazno, y las otras solo un enlace. Con algo pendiente o en modo Pro, las tres van
 * compactas (foto, título y enlace), sin botón.
 */
export function LineCards({
  order,
  lead,
  lines,
  birthday,
  onFamilies,
}: {
  /** Las tres líneas, siempre en el mismo orden: Familias, Celebraciones y Profesionales. */
  order: HomeChannel[];
  /** La línea destacada (null: las tres compactas). */
  lead: HomeChannel | null;
  lines: LineCopy;
  /** Hay un kit de cumpleaños en curso: Familias ofrece el libro del cumpleañero. */
  birthday: boolean;
  /** Al tocar Familias (por ejemplo, para reutilizar el personaje del último pedido). */
  onFamilies?: () => void;
}) {
  const t = useTranslations('HomeSession.create');
  const compact = lead === null;
  return (
    <section aria-labelledby="home-create" className="grid gap-4">
      <h2 id="home-create" className="text-[1.45rem] font-bold">
        {t('title')}
      </h2>
      <ul className={cn('grid gap-3 lg:grid-cols-3 lg:gap-4', compact && 'sm:grid-cols-3')}>
        {order.map((line) => {
          const isLead = line === lead;
          const swap = line === 'families' && birthday;
          const title = swap ? t('birthday.title') : t(`${line}.title`);
          const link = swap ? t('birthday.link') : t(`${line}.link`);
          return (
            <li key={line} className="min-w-0">
              <Link
                href={{ pathname: '/create', query: { line } }}
                onClick={line === 'families' ? onFamilies : undefined}
                data-track="home_line_click"
                data-track-line={line}
                data-track-lead={isLead ? 'yes' : 'no'}
                className={cn(
                  cardClass,
                  'group grid h-full overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  isLead && 'border-2 border-foreground',
                  compact
                    ? 'grid-cols-[96px_minmax(0,1fr)]'
                    : 'grid-cols-[96px_minmax(0,1fr)] min-[421px]:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-1 lg:grid-rows-[auto_1fr]',
                )}
              >
                <span
                  className={cn(
                    'relative block min-h-24 overflow-hidden',
                    line === 'families' && 'bg-[#e4f3ef]',
                    line === 'events' && 'bg-[#ffe7df]',
                    line === 'professionals' && 'bg-[#eee8fa]',
                    !compact && 'lg:aspect-[16/10]',
                  )}
                >
                  <Image
                    src={LINE_IMAGES[line]}
                    alt=""
                    fill
                    unoptimized
                    sizes={compact ? '96px' : '(min-width: 1024px) 360px, 132px'}
                    className="object-cover"
                  />
                </span>
                <span
                  className={cn(
                    'grid content-start gap-2',
                    compact ? 'gap-1 px-3.5 py-3' : 'px-3.5 py-3 sm:px-4.5 sm:py-4',
                  )}
                >
                  <LineChip line={line} label={lines[line].chip} />
                  <span
                    className={cn(
                      'block leading-tight font-bold text-balance',
                      compact ? 'text-[1.02rem]' : 'text-[1.1rem] lg:text-[1.2rem]',
                    )}
                  >
                    {title}
                  </span>
                  {!compact && (
                    <span className="hidden text-[0.95rem] text-muted-foreground min-[421px]:block">
                      {lines[line].text}
                    </span>
                  )}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {isLead ? (
                      <>
                        <span
                          className={cn(
                            buttonVariants(),
                            'max-w-full px-5 text-center whitespace-normal',
                          )}
                        >
                          {t(`${line}.cta`)}
                        </span>
                        <span className="text-[0.82rem] text-muted-foreground">
                          {t(`${line}.fine`)}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex min-h-11 w-fit items-center gap-1.5 border-b-2 border-foreground/20 px-0.5 font-bold transition-colors group-hover:border-primary group-hover:text-primary">
                        {link}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
