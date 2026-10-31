import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { LessonGroups } from '@/components/lessons/lesson-groups';
import { localizedAlternates } from '@/lib/seo';
import { getLessons } from '@/lib/server/api';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Lessons' });
  return {
    title: t('indexTitle'),
    description: t('indexMeta'),
    alternates: localizedAlternates(locale as Locale, () => '/lessons'),
  };
}

/** Todas las enseñanzas, agrupadas (Valores, Confianza, Momentos de la vida y Emociones). */
export default async function LessonsIndexPage({ params }: Props) {
  const { locale } = await params;
  const [lessons, t] = await Promise.all([
    getLessons(locale as Locale).catch(() => []),
    getTranslations('Lessons'),
  ]);
  return (
    <div className="container-page py-12">
      <header className="max-w-3xl">
        <h1 className="text-[clamp(2.3rem,4.5vw,3.6rem)] leading-[1.1] font-medium">
          {t('indexTitle')}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t('indexText')}</p>
      </header>
      <div className="mt-10">
        <LessonGroups lessons={lessons} />
      </div>
    </div>
  );
}
