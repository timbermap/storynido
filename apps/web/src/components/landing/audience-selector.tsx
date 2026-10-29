import { BookHeart, ChevronRight, GraduationCap, PartyPopper } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

/** "¿Para quién es?": la puerta de entrada a la landing de cada público (Familias, Cumpleaños y Profesionales). */
export async function AudienceSelector() {
  const t = await getTranslations('Home.audience');
  const audiences = [
    {
      key: 'families',
      href: '/families',
      icon: BookHeart,
      card: 'bg-[#e4f3ef]',
      tone: 'text-[#2f6f66]',
      ring: 'border-[#2f6f66]/30 text-[#2f6f66]',
    },
    {
      key: 'events',
      href: '/events',
      icon: PartyPopper,
      card: 'bg-[#ffe7df]',
      tone: 'text-[#a33f33]',
      ring: 'border-[#a33f33]/30 text-[#a33f33]',
    },
    {
      key: 'professionals',
      href: '/professionals',
      icon: GraduationCap,
      card: 'bg-[#eee8fa]',
      tone: 'text-[#5b4a99]',
      ring: 'border-[#5b4a99]/30 text-[#5b4a99]',
    },
  ] as const;

  return (
    <section aria-labelledby="audience" className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-16 rounded-t-[50%_100%] bg-[#fff1e6]"
      />
      <div className="relative bg-[#fff1e6] pb-12 lg:pb-16">
        <div className="container-page">
          <div className="mx-auto max-w-2xl pb-8 text-center">
            <h2
              id="audience"
              className="scroll-mt-28 text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium"
            >
              {t('title')}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {audiences.map(({ key, href, icon: Icon, card, tone, ring }) => (
              <li key={key}>
                <Link
                  href={href}
                  className={`group flex h-full items-center gap-5 rounded-[1.75rem] p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] sm:p-6 ${card}`}
                >
                  <Icon
                    className={`size-12 shrink-0 sm:size-14 ${tone}`}
                    strokeWidth={1.4}
                    aria-hidden="true"
                  />
                  <span className="grid flex-1 gap-1">
                    <span className="font-display text-[1.45rem] leading-tight font-semibold">
                      {t(`${key}.title`)}
                    </span>
                    <span className="text-[0.95rem] leading-snug text-muted-foreground">
                      {t(`${key}.text`)}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid size-10 shrink-0 place-items-center rounded-full border-2 bg-white/60 transition group-hover:translate-x-0.5 ${ring}`}
                  >
                    <ChevronRight className="size-5" />
                  </span>
                  <span className="sr-only">{t(`${key}.cta`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
