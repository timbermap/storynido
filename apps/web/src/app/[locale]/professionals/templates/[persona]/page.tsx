import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { RememberChannel } from '@/components/landing/remember-channel';
import { CatalogLineChips } from '@/components/layout/catalog-line-chips';
import { PERSONA_ICONS, PersonaChips, PersonaStoryGrid } from '@/components/professionals/personas';
import { PERSONA_SLUGS, personaFromSlug, personaStories } from '@/lib/professional-personas';
import { localizedAlternates } from '@/lib/seo';
import { getStories } from '@/lib/server/api';

interface Props {
  params: Promise<{ locale: string; persona: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, persona } = await params;
  const locale = raw as Locale;
  const key = personaFromSlug(locale, persona);
  if (!key) return {};
  const t = await getTranslations({ locale, namespace: 'Landing.professionals' });
  return {
    title: t(`personas.${key}.title`),
    description: t(`personas.${key}.meta`),
    alternates: localizedAlternates(locale, (target) => ({
      pathname: '/professionals/templates/[persona]',
      params: { persona: PERSONA_SLUGS[target][key] },
    })),
  };
}

/** Plantillas de un tipo de profesional (mesa 25 Nov 2026): sus historias primero, en su orden. */
export default async function ProfessionalPersonaPage({ params }: Props) {
  const { locale: raw, persona } = await params;
  const locale = raw as Locale;
  const key = personaFromSlug(locale, persona);
  if (!key) notFound();
  const [t, all] = await Promise.all([
    getTranslations('Landing.professionals'),
    getStories(locale, undefined, { channel: 'professionals' }).catch(() => []),
  ]);
  const stories = personaStories(key, all);
  const Icon = PERSONA_ICONS[key];
  return (
    <>
      <RememberChannel channel="professionals" />
      <CatalogLineChips />
      <div className="container-page pt-14 pb-20 lg:pb-24">
        <p className="inline-flex items-center gap-2 rounded-full bg-[#eee8fa] px-3 py-1 text-sm font-semibold text-[#5b4a99]">
          <Icon className="size-4" aria-hidden="true" />
          {t(`personas.${key}.name`)}
        </p>
        <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-tight font-medium">
          {t(`personas.${key}.title`)}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{t(`personas.${key}.intro`)}</p>
        <div className="mt-6 max-w-3xl rounded-xl bg-muted p-5">
          <h2 className="text-lg font-semibold">{t('personaUsesTitle')}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/85">
            {(['1', '2', '3'] as const).map((n) => (
              <li key={n}>{t(`personas.${key}.uses.${n}`)}</li>
            ))}
          </ul>
        </div>
        <PersonaChips locale={locale} current={key} />
        <h2 className="mt-12 text-[clamp(1.6rem,2.6vw,2.2rem)] leading-tight font-medium">
          {t('personaStoriesTitle')}
        </h2>
        <PersonaStoryGrid stories={stories} />
        <p className="mt-10 max-w-3xl text-sm text-muted-foreground">{t('personaNote')}</p>
      </div>
    </>
  );
}
