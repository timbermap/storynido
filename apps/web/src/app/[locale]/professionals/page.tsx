import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { JsonLd } from '@/components/json-ld';
import { RememberChannel } from '@/components/landing/remember-channel';
import {
  LandingChecklist,
  LandingCollections,
  LandingFaq,
  LandingFinalCta,
  LandingHero,
  LandingSteps,
  ctaClass,
} from '@/components/landing/sections';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { localizedAlternates } from '@/lib/seo';
import { getCollections } from '@/lib/server/api';
import { absoluteUrl } from '@/lib/site';

import professionalsArt from '../../../../public/brand/landing-profesionales.webp';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Landing.professionals' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, () => '/professionals'),
  };
}

/**
 * StoryNido Profesionales: colecciones educativas y una cuenta para todos los proyectos.
 * A diferencia de Familias y Eventos, se crea con cuenta (el creador la pide antes de empezar).
 */
export default async function ProfessionalsPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const [t, collections] = await Promise.all([
    getTranslations('Landing.professionals'),
    getCollections(locale, 'professionals').catch(() => []),
  ]);
  const cta = (
    <Link href={{ pathname: '/create', query: { line: 'professionals' } }} className={ctaClass}>
      {t('cta')}
    </Link>
  );
  const four = ['1', '2', '3', '4'] as const;

  return (
    <>
      <RememberChannel channel="professionals" />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: t('metaTitle'),
          description: t('metaDescription'),
          audience: {
            '@type': 'Audience',
            audienceType: 'Education and child health professionals',
          },
          provider: { '@type': 'Organization', name: brand.name, url: absoluteUrl('/') },
        }}
      />
      <LandingHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        cta={cta}
        note={t('note')}
        image={professionalsArt}
        imageAlt={t('imageAlt')}
      />
      <LandingSteps
        title={t('howTitle')}
        steps={(['1', '2', '3'] as const).map((key) => ({
          title: t(`steps.${key}.title`),
          text: t(`steps.${key}.text`),
        }))}
      />
      <LandingChecklist
        title={t('benefitsTitle')}
        items={four.map((key) => ({
          title: t(`benefits.${key}.title`),
          text: t(`benefits.${key}.text`),
        }))}
        note={t('disclaimer')}
      />
      <LandingCollections title={t('collectionsTitle')} collections={collections} />
      <LandingFaq
        title={t('faqTitle')}
        items={four.map((key) => ({ question: t(`faq.${key}.q`), answer: t(`faq.${key}.a`) }))}
      />
      <LandingFinalCta title={t('finalTitle')} cta={cta} />
    </>
  );
}
