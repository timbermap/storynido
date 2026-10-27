import { getTranslations } from 'next-intl/server';

import { LESSON_GROUPS, type PublicLesson } from '@storynido/shared';

import { Link } from '@/i18n/navigation';

/** Color de cada grupo: un punto que lo identifica (los pasteles no son texto). */
const GROUP_DOTS: Record<PublicLesson['group'], string> = {
  values: 'bg-[#d9895c]',
  confidence: 'bg-[#c99a2e]',
  life: 'bg-[#5b8fc4]',
  emotions: 'bg-[#c86b93]',
};

/** Enseñanzas agrupadas como chips que llevan a su página. */
export async function LessonGroups({ lessons }: { lessons: PublicLesson[] }) {
  const t = await getTranslations('Lessons');
  return (
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {LESSON_GROUPS.map((group) => {
        const items = lessons.filter((lesson) => lesson.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="border-t border-border pt-5">
            <h3 className="flex items-center gap-2 font-sans text-sm font-bold tracking-[0.12em] text-foreground/80 uppercase">
              <span aria-hidden="true" className={`size-2 rounded-full ${GROUP_DOTS[group]}`} />
              {t(`groups.${group}`)}
            </h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {items.map((lesson) => (
                <li key={lesson.slug}>
                  <Link
                    href={{ pathname: '/lessons/[slug]', params: { slug: lesson.slug } }}
                    className="inline-block rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground/85 transition-colors hover:border-primary/50 hover:text-primary"
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
