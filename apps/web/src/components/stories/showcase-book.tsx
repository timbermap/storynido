'use client';

import { splitCoverTitle } from '@storynido/shared';
import { useTranslations } from 'next-intl';

import { BookViewer, type ViewerPage } from '@/components/book/book-viewer';
import { CoverTitle } from '@/components/stories/story-cover';
import type { ShowcaseBookView } from '@/lib/server/api';

/**
 * Un libro de ejemplo aprobado por la mesa (DECISIONS 348): la tapa y las páginas armadas tal cual
 * salieron, en el mismo visor que la muestra gratis. Cada página ya trae su texto.
 */
export function ShowcaseViewer({ book }: { book: ShowcaseBookView }) {
  const t = useTranslations('Showcase');
  const tViewer = useTranslations('Viewer');
  const pages: ViewerPage[] = [
    { key: 'cover', kind: 'cover', imageUrl: book.cover, text: null },
    ...book.pages.map((page, index): ViewerPage => ({
      key: `page-${String(index + 1)}`,
      kind: 'story',
      imageUrl: page.image,
      text: null,
      number: index + 1,
      composed: true,
      layout: { kind: 'overlay', side: 'top' },
    })),
  ];
  return (
    <BookViewer
      title={book.title}
      coverName={book.childName}
      pages={pages}
      badge={t('badge')}
      lockedLabel={tViewer('locked')}
      imageAlt={(page) =>
        page.kind === 'cover'
          ? t('coverAlt', { title: book.title })
          : t('pageAlt', {
              number: page.number ?? 0,
              text: book.pages[(page.number ?? 1) - 1]?.text ?? '',
            })
      }
    />
  );
}

/** La tapa de un ejemplo, con el título en la misma letra que el catálogo. */
export function ShowcaseCover({ book }: { book: ShowcaseBookView }) {
  const t = useTranslations('Showcase');
  return (
    <div className="[container-type:inline-size] relative aspect-[3/4] w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={book.cover}
        alt={t('coverAlt', { title: book.title })}
        loading="lazy"
        className="size-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[#fffaf5]/90 via-[#fffaf5]/60 to-transparent"
      />
      <div aria-hidden="true" className="contents">
        <CoverTitle {...splitCoverTitle(book.title, book.childName)} />
      </div>
    </div>
  );
}
