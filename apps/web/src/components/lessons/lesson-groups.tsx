import { getTranslations } from 'next-intl/server';

import { LESSON_GROUPS, type PublicLesson } from '@storynido/shared';

import { Link } from '@/i18n/navigation';

const GROUP_STYLES: Record<PublicLesson['group'], string> = {
  values: 'bg-peach',
  confidence: 'bg-butter',
  life: 'bg-sky',
  emotions: 'bg-rose',
};

/** Enseñanzas agrupadas como chips que llevan a su página. */
export async function LessonGroups({ lessons }: { lessons: PublicLesson[] }) {
  const t = await getTranslations('Lessons');
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {LESSON_GROUPS.map((group) => {
        const items = lessons.filter((lesson) => lesson.group === group);
        if (items.length === 0) return null;
        return (
          <section
            key={group}
            className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <h3 className="text-xl font-semibold">{t(`groups.${group}`)}</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {items.map((lesson) => (
                <li key={lesson.slug}>
                  <Link
                    href={{ pathname: '/lessons/[slug]', params: { slug: lesson.slug } }}
                    className={`inline-block rounded-full px-4 py-2 text-sm font-bold text-foreground transition hover:ring-2 hover:ring-primary/40 ${GROUP_STYLES[group]}`}
                  >
                    {lesson.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
