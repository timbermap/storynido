import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DEFAULT_PRO_DISCOUNTS, type Locale } from '@storynido/shared';

import { AuthLink } from '@/components/auth/auth-link';
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
import { brand } from '@/lib/brand';
import { localizedAlternates } from '@/lib/seo';
import { lowestPrice } from '@/lib/offer';
import { getCollections, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { absoluteUrl } from '@/lib/site';

import professionalsArt from '../../../../public/brand/landing-profesionales.webp';
import { AnchorLink } from '@/components/anchor-link';

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
  const display = await getDisplayCountry(locale);
  const [t, collections, stories, offer] = await Promise.all([
    getTranslations('Landing.professionals'),
    getCollections(locale, 'professionals').catch(() => []),
    getStories(locale, undefined, { channel: 'professionals' }).catch(() => []),
    getOffer(display.country, locale),
  ]);
  const price = lowestPrice(offer, locale, display.country);
  // Descuentos por volumen (no hay suscripción): los escalones de fábrica de la cuenta.
  const [first, second, third] = DEFAULT_PRO_DISCOUNTS.tiers;
  const cta = (
    <AuthLink
      href={{ pathname: '/create', query: { line: 'professionals' } }}
      guest={t('cta')}
      member={t('ctaSignedIn')}
      className={ctaClass}
    />
  );
  // Arriba, primero los ejemplos: la cuenta se pide recién al crear.
  const heroCta = (
    <AnchorLink target="examples" className={ctaClass}>
      {t('ctaExamples')}
    </AnchorLink>
  );
  const four = ['1', '2', '3', '4'] as const;
  const six = ['1', '2', '3', '4', '5', '6'] as const;

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
      {/* Precio a la vista y sin suscripción: se paga cada cuento, con descuento por volumen. */}
      <LandingChecklist
        title={t('pricingTitle')}
        subtitle={t('pricingSubtitle')}
        items={[
          {
            title: t('pricing.1.title'),
            text: t('pricing.1.text', { price: price ?? '—' }),
          },
          {
            title: t('pricing.2.title'),
            text: t('pricing.2.text', {
              n1: first?.minPurchases ?? 5,
              p1: first?.percent ?? 10,
              n2: second?.minPurchases ?? 10,
              p2: second?.percent ?? 15,
              n3: third?.minPurchases ?? 20,
              p3: third?.percent ?? 20,
              days: DEFAULT_PRO_DISCOUNTS.windowDays,
            }),
          },
          { title: t('pricing.3.title'), text: t('pricing.3.text') },
        ]}
        note={t('pricingNote')}
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
        items={six.map((key) => ({ question: t(`faq.${key}.q`), answer: t(`faq.${key}.a`) }))}
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
