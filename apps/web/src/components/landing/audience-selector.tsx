import { ArrowRight, BookHeart, GraduationCap, PartyPopper } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

/** "¿Para quién es?": acceso en un clic a cada línea comercial desde la home. */
export async function AudienceSelector() {
  const t = await getTranslations('Home.audience');
  const audiences = [
    { key: 'families', href: '/create', icon: BookHeart, tone: 'bg-secondary text-primary' },
    { key: 'events', href: '/events', icon: PartyPopper, tone: 'bg-peach text-[#8a4a2a]' },
    {
      key: 'professionals',
      href: '/professionals',
      icon: GraduationCap,
      tone: 'bg-mint text-success',
    },
  ] as const;

  return (
    <section aria-labelledby="audience" className="container-page pb-6 lg:pb-10">
      <div className="text-center">
        <h2 id="audience" className="text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.1] font-semibold">
          {t('title')}
        </h2>
        <p className="mt-2 text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {audiences.map(({ key, href, icon: Icon, tone }) => (
          <li key={key}>
            <Link
              href={href}
              className="group flex h-full flex-col rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span className={`grid size-12 place-items-center rounded-2xl ${tone}`}>
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="mt-4 font-display text-2xl font-semibold">{t(`${key}.title`)}</span>
              <span className="mt-2 flex-1 text-muted-foreground">{t(`${key}.text`)}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 font-bold text-primary">
                {t(`${key}.cta`)}
                <ArrowRight
                  className="size-4 transition group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
