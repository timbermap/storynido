'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import type { Locale, PublicStory } from '@storynido/shared';

import { buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { createDraft } from '@/lib/firebase/drafts';
import type { HomePro } from '@/lib/firebase/home-data';
import { HOME_ROWS, isOpenOrder, isShipped, type HomeRow } from '@/lib/home-state';
import { titleForChild } from '@/lib/story-title';
import { cn } from '@/lib/utils';

import { bookStatus, type Translate } from './next-card';
import { LineChip, Thumb, cardClass, type LineCopy } from './parts';

/** Filas visibles en la home; el resto queda en Mis cuentos. */
export const MAX_ROWS = HOME_ROWS;

const actionClass =
  'inline-flex min-h-11 items-center text-[0.92rem] font-bold whitespace-nowrap text-primary underline-offset-4 hover:underline disabled:opacity-60';

/**
 * «Tus proyectos»: borradores y pedidos de todas las líneas en una sola lista. En modo Pro se llama
 * «Proyectos por niño», lleva el botón «Nuevo proyecto» y el avance del descuento por volumen.
 */
export function ProjectList({
  rows,
  lines,
  stories,
  pro,
  proStatus,
  uid,
}: {
  rows: HomeRow[];
  lines: LineCopy;
  stories: PublicStory[];
  /** Modo Pro (lista arriba, botón «Nuevo proyecto»). */
  pro: boolean;
  proStatus: HomePro;
  uid: string | null;
}) {
  const t = useTranslations('HomeSession');
  const tPro = useTranslations('Pro.account');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [copying, setCopying] = useState<string | null>(null);
  const tr = t as unknown as Translate;
  const storyOf = (id: string | null) => stories.find((story) => story.slug === id);

  // «Repetir configuración» (Profesionales): la misma de Mis cuentos, sin datos del niño.
  async function repeat(row: Extract<HomeRow, { kind: 'project' }>) {
    if (!uid) return;
    setCopying(row.book.id);
    try {
      const id = await createDraft(await getFirebaseDb(), uid, {
        language: locale,
        storyId: row.book.storyId,
        lessonId: null,
        channel: 'professionals',
        settings: row.book.settings,
      });
      router.push({ pathname: '/create/[bookId]', params: { bookId: id } });
    } finally {
      setCopying(null);
    }
  }

  const discount = pro ? (proStatus?.discount ?? null) : null;
  const shown = rows.slice(0, MAX_ROWS);
  const allHref = pro ? { pathname: '/my-stories' as const, hash: 'pro' } : '/my-stories';

  return (
    <section aria-labelledby="home-projects" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="home-projects" className="text-[1.45rem] font-bold">
          {pro ? t('list.titlePro') : t('list.title')}
        </h2>
        {pro ? (
          <Link
            href={{ pathname: '/create', query: { line: 'professionals' } }}
            className={buttonVariants({ size: 'lg' })}
            data-track="home_hero_click"
            data-track-state="pro"
            data-track-line="professionals"
          >
            {tPro('newProject')}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <Link href={allHref} className={actionClass}>
            {t('list.all')}
          </Link>
        )}
      </div>
      <div className={cn(cardClass, 'overflow-hidden rounded-[1.25rem]')}>
        <ul>
          {shown.map((row) => {
            let title: string;
            let status: string;
            let src: string | null = null;
            let story: PublicStory | undefined;
            let name: string | null = null;
            let action;
            if (row.kind === 'project') {
              const storyTitle = storyOf(row.book.storyId)?.title ?? tPro('untitled');
              title = `${row.project.label} · ${storyTitle}`;
              status = tPro.has(`status.${row.book.status}`)
                ? tPro(`status.${row.book.status}` as 'status.draft')
                : row.book.status;
              src = row.preview?.coverUrl ?? row.preview?.characterUrl ?? null;
              story = storyOf(row.book.storyId);
              action =
                row.book.status !== 'ordered' ? (
                  <Link
                    href={{ pathname: '/create/[bookId]', params: { bookId: row.book.id } }}
                    className={actionClass}
                  >
                    {tPro('continue')}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cn(actionClass, 'gap-1.5')}
                    disabled={copying !== null || !uid}
                    onClick={() => void repeat(row)}
                  >
                    {copying === row.book.id && (
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    )}
                    {tPro('repeat')}
                  </button>
                );
            } else if (row.kind === 'book') {
              const { book } = row;
              name = book.childName;
              story = storyOf(book.storyId);
              if (book.channel === 'events') {
                const kit = name ? t('list.kitOf', { name }) : t('list.kitUntitled');
                title = book.eventTheme ? `${kit} · ${book.eventTheme}` : kit;
              } else {
                title =
                  book.title ??
                  (story ? titleForChild(story, name, locale) : null) ??
                  (name ? t('list.storyOf', { name }) : t('list.untitled'));
              }
              status = bookStatus(tr, book.stage, book.channel);
              src =
                book.coverUrl ?? (book.stage === 'character' ? book.characterUrl : null) ?? null;
              action = (
                <Link
                  href={{ pathname: '/create/[bookId]', params: { bookId: book.id } }}
                  className={actionClass}
                >
                  {t('list.continue')}
                </Link>
              );
            } else {
              const { order } = row;
              name = order.childName;
              title =
                order.title ??
                (name
                  ? t(order.channel === 'events' ? 'list.kitOf' : 'list.storyOf', { name })
                  : t('list.untitled'));
              status = isOpenOrder(order)
                ? t(isShipped(order) ? 'list.status.shipped' : 'list.status.preparing')
                : t('list.status.bought');
              src = order.coverUrl ?? order.characterUrl;
              action = (
                <Link
                  href={{ pathname: '/order/[orderId]', params: { orderId: order.id } }}
                  className={actionClass}
                >
                  {t('list.order')}
                </Link>
              );
            }
            return (
              <li
                key={row.key}
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 border-t px-3.5 py-3 first:border-t-0 sm:gap-3.5 sm:px-4.5"
              >
                <span className="relative block aspect-[3/4] w-11 overflow-hidden rounded-[4px_8px_8px_4px] bg-muted">
                  <Thumb src={src} story={story} name={name} line={row.line} sizes="44px" />
                </span>
                <span className="grid min-w-0 gap-1">
                  <span className="font-bold break-words sm:truncate">{title}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem] text-muted-foreground">
                    <LineChip line={row.line} label={lines[row.line].chip} small />
                    {status}
                  </span>
                </span>
                {action}
              </li>
            );
          })}
        </ul>
        {discount && (
          <div className="grid gap-1.5 bg-[#eee8fa] px-4.5 py-3.5 text-[0.9rem] font-semibold text-[#5b4a99]">
            <p>{tPro('purchases', { count: discount.purchases, days: discount.windowDays })}</p>
            <p className="font-medium">
              {discount.digitalPercent > 0
                ? tPro('discount', {
                    digital: discount.digitalPercent,
                    print: discount.printPercent,
                  })
                : tPro('basePrice')}
            </p>
            {discount.next && (
              <>
                <p className="font-medium">
                  {tPro('next', {
                    missing: discount.next.purchases - discount.purchases,
                    percent: discount.next.percent,
                  })}
                </p>
                <span className="h-2 overflow-hidden rounded-full bg-white" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-[#8c79c9]"
                    style={{
                      width: `${String(Math.min(100, Math.round((discount.purchases / discount.next.purchases) * 100)))}%`,
                    }}
                  />
                </span>
              </>
            )}
          </div>
        )}
        {pro && rows.length > MAX_ROWS && (
          <div className="border-t px-4.5 py-2">
            <Link href={allHref} className={actionClass}>
              {t('list.all')}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
