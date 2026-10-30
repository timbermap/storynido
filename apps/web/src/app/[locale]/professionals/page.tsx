import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { SignedInLabel } from '@/components/auth/signed-in-label';
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
import { PhotoPromise } from '@/components/landing/photo-promise';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { localizedAlternates } from '@/lib/seo';
import { getCollections, getStories } from '@/lib/server/api';
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
  const [t, collections, stories] = await Promise.all([
    getTranslations('Landing.professionals'),
    getCollections(locale, 'professionals').catch(() => []),
    getStories(locale, undefined, { channel: 'professionals' }).catch(() => []),
  ]);
  const cta = (
    <Link href={{ pathname: '/create', query: { line: 'professionals' } }} className={ctaClass}>
      <SignedInLabel guest={t('cta')} member={t('ctaSignedIn')} />
    </Link>
  );
  // Arriba, primero los ejemplos: la cuenta se pide recién al crear.
  const heroCta = (
    <>
      <a href="#examples" className={ctaClass}>
        {t('ctaExamples')}
      </a>
      <Link
        href={{ pathname: '/create', query: { line: 'professionals' } }}
        className="inline-flex items-center justify-center border-b-2 border-foreground/25 px-1 pb-0.5 text-lg font-semibold transition-colors hover:border-primary hover:text-primary"
      >
        <SignedInLabel guest={t('cta')} member={t('ctaSignedIn')} />
      </Link>
    </>
  );
  const four = ['1', '2', '3', '4'] as const;

  return (
    <>
      <RememberChannel channel="professionals" />
      <LandingHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        cta={heroCta}
        note={t('note')}
        image={professionalsArt}
        imageAlt={t('imageAlt')}
      />
      <LandingCollections
        id="examples"
        title={t('collectionsTitle')}
        subtitle={t('collectionsSubtitle')}
        collections={collections}
        stories={stories}
        createLabel={t('viewStory')}
        line="professionals"
        start={{ label: t('collectionStart'), mode: 'story' }}
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
      <PhotoPromise />

      <LandingFaq
        title={t('faqTitle')}
        items={four.map((key) => ({ question: t(`faq.${key}.q`), answer: t(`faq.${key}.a`) }))}
      />
      <LandingFinalCta title={t('finalTitle')} cta={cta} />
      {/* Datos para buscadores (schema.org), después del contenido visible. */}
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
    </>
  );
}
