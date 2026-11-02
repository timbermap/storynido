'use client';

import { BadgeCheck, Copy, Loader2, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { Locale, PublicStory } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getFirebaseDb } from '@/lib/firebase/client';
import { clearStepDrafts } from '@/lib/use-step-draft';
import { createDraft, listProjects, type Project, type ProjectBook } from '@/lib/firebase/drafts';

import type { ProStatus } from './use-pro-status';

/** "Mi cuenta" Pro: descuento vigente, proyectos por alias y "Repetir configuración". */
export function ProPanel({
  uid,
  status,
  onBooks,
}: {
  uid: string;
  status: ProStatus;
  /** Ids de los libros que ya se ven en los proyectos (para no repetirlos en «En proceso»). */
  onBooks?: (ids: Set<string>) => void;
}) {
  const t = useTranslations('Pro.account');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [copying, setCopying] = useState<string | null>(null);
  // Borrar pide confirmación en la misma fila (se pierden la muestra y sus ilustraciones).
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
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
        onBooks?.(new Set(found.flatMap((project) => project.books.map((book) => book.id))));
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
  }, [uid, locale, attempt, onBooks]);

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

  async function remove(book: ProjectBook) {
    setDeleting(book.id);
    setDeleteFailed(false);
    try {
      await api('deleteDraft', { params: { bookId: book.id } });
      clearStepDrafts(book.id);
      // Sin ese libro; un proyecto que se queda sin libros desaparece de la lista.
      setProjects(
        (current) =>
          current
            ?.map((project) => ({
              ...project,
              books: project.books.filter((item) => item.id !== book.id),
            }))
            .filter((project) => project.books.length > 0) ?? null,
      );
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  const title = (book: ProjectBook) =>
    stories.find((story) => story.slug === book.storyId)?.title ?? t('untitled');

  // «Tus proyectos» y el descuento solo aparecen cuando la persona ya trabajó un proyecto
  // profesional; mientras tanto Mis cuentos queda simple, igual que para Familias y Celebraciones.
  // (Mientras carga tampoco se muestra nada, para que no aparezca y desaparezca.)
  if (!failed && (projects === null || projects.length === 0)) return null;

  return (
    <section id="pro" className="grid scroll-mt-28 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-medium">
          <BadgeCheck className="size-6 text-primary" aria-hidden="true" />
          {t('title')}
        </h2>
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
                    {book.status !== 'ordered' &&
                      (confirming === book.id ? (
                        <span className="flex flex-wrap items-center gap-2" role="alertdialog">
                          <span>{t('deleteConfirm')}</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleting !== null}
                            onClick={() => void remove(book)}
                          >
                            {deleting === book.id && (
                              <Loader2 className="animate-spin" aria-hidden="true" />
                            )}
                            {t('deleteYes')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deleting !== null}
                            onClick={() => {
                              setConfirming(null);
                            }}
                          >
                            {t('deleteNo')}
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t('delete', { title: title(book) })}
                          onClick={() => {
                            setConfirming(book.id);
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {deleteFailed && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {t('deleteError')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('repeatNote')}</p>
    </section>
  );
}
