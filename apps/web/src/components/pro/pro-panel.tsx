'use client';

import { BadgeCheck, Copy } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { Locale, PublicStory } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getFirebaseDb } from '@/lib/firebase/client';
import { createDraft, listProjects, type Project, type ProjectBook } from '@/lib/firebase/drafts';

import type { ProStatus } from './use-pro-status';

/** "Mi cuenta" Pro: descuento vigente, proyectos por alias y "Repetir configuración". */
export function ProPanel({ uid, status }: { uid: string; status: ProStatus }) {
  const t = useTranslations('Pro.account');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [copying, setCopying] = useState<string | null>(null);
  const discount = status.discount;

  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Sin respuesta en 12 s se avisa: antes quedaba "Cargando proyectos…" para siempre.
    const timer = setTimeout(() => {
      setFailed(true);
    }, 12_000);
    void getFirebaseDb()
      .then((db) => listProjects(db, uid))
      .then((found) => {
        clearTimeout(timer);
        setFailed(false);
        setProjects(found);
      })
      .catch(() => {
        clearTimeout(timer);
        setFailed(true);
      });
    api('catalogStories', { query: { locale } })
      .then((result) => {
        setStories(result.stories);
      })
      .catch(() => {
        // Sin catálogo se muestra el proyecto igual, sin el título de la historia.
      });
    return () => {
      clearTimeout(timer);
    };
  }, [uid, locale, attempt]);

  async function repeat(book: ProjectBook) {
    setCopying(book.id);
    try {
      const id = await createDraft(await getFirebaseDb(), uid, {
        language: locale,
        storyId: book.storyId,
        lessonId: null,
        channel: 'professionals',
        settings: book.settings,
      });
      router.push({ pathname: '/create/[bookId]', params: { bookId: id } });
    } finally {
      setCopying(null);
    }
  }

  const title = (book: ProjectBook) =>
    stories.find((story) => story.slug === book.storyId)?.title ?? t('untitled');

  return (
    <section id="pro" className="grid scroll-mt-28 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-medium">
          <BadgeCheck className="size-6 text-primary" aria-hidden="true" />
          {t('title')}
        </h2>
        <Button asChild size="sm">
          <Link href={{ pathname: '/create', query: { line: 'professionals' } }}>
            {t('newProject')}
          </Link>
        </Button>
      </div>
      {discount && (
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <p className="font-semibold">
            {t('purchases', { count: discount.purchases, days: discount.windowDays })}
          </p>
          <p className="mt-1">
            {discount.digitalPercent > 0
              ? t('discount', { digital: discount.digitalPercent, print: discount.printPercent })
              : t('basePrice')}
          </p>
          {discount.next && (
            <p className="mt-1 text-muted-foreground">
              {t('next', {
                missing: discount.next.purchases - discount.purchases,
                percent: discount.next.percent,
              })}
            </p>
          )}
        </div>
      )}
      {failed && projects === null ? (
        <div role="alert" className="grid justify-items-start gap-2 text-sm">
          <p className="text-destructive">{t('loadFailed')}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
            className="font-semibold text-primary hover:underline"
          >
            {t('retry')}
          </button>
        </div>
      ) : projects === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('loading')}
        </p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="grid gap-3">
          {projects.map((project) => (
            <li key={project.childId} className="rounded-2xl border bg-card p-4">
              <p className="font-semibold">{project.label}</p>
              <ul className="mt-2 grid gap-2">
                {project.books.map((book) => (
                  <li key={book.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1">
                      {title(book)}
                      <span className="text-muted-foreground"> · {t(`status.${book.status}`)}</span>
                      {book.goal && <span className="text-muted-foreground"> · {book.goal}</span>}
                    </span>
                    {book.status !== 'ordered' && (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={{ pathname: '/create/[bookId]', params: { bookId: book.id } }}>
                          {t('continue')}
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={copying !== null}
                      onClick={() => void repeat(book)}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                      {t('repeat')}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t('repeatNote')}</p>
    </section>
  );
}
