import { BookHeart, ChevronRight, GraduationCap, PartyPopper } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

/** "¿Para quién es?": acceso en un clic a cada línea comercial, justo debajo del hero. */
export async function AudienceSelector() {
  const t = await getTranslations('Home.audience');
  const audiences = [
    {
      key: 'families',
      href: '/create',
      icon: BookHeart,
      card: 'bg-[#f6eefa]',
      tone: 'text-primary',
      ring: 'border-primary/25 text-primary',
    },
    {
      key: 'events',
      href: '/events',
      icon: PartyPopper,
      card: 'bg-[#fbeee6]',
      tone: 'text-[#c0764a]',
      ring: 'border-[#c0764a]/30 text-[#a8633b]',
    },
    {
      key: 'professionals',
      href: '/professionals',
      icon: GraduationCap,
      card: 'bg-[#eaf5ef]',
      tone: 'text-[#3f8f73]',
      ring: 'border-[#3f8f73]/30 text-[#357a62]',
    },
  ] as const;

  return (
    <section aria-labelledby="audience" className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-16 rounded-t-[50%_100%] bg-[#fbf6f0]"
      />
      <div className="relative bg-[#fbf6f0] pb-12 lg:pb-16">
        <div className="container-page">
          <h2 id="audience" className="sr-only">
            {t('title')}
          </h2>
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
