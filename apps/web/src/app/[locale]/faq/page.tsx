import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { CONTACT_ID, ContactForm } from '@/components/home/contact-form';
import { FaqGroups, parseFaq, parseFaqGroups } from '@/components/home/faq-list';
import { JsonLd } from '@/components/json-ld';
import { localizedAlternates } from '@/lib/seo';
import { getContent } from '@/lib/server/api';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Home.faq' });
  return {
    title: t('title'),
    description: t('pageDescription'),
    alternates: localizedAlternates(locale, () => '/faq'),
  };
}

/**
 * Todas las preguntas frecuentes, por tema, y el formulario de contacto al final. Las landings
 * muestran solo las destacadas (DECISIONS 119).
 */
export default async function FaqPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const [t, tContact, faq] = await Promise.all([
    getTranslations('Home.faq'),
    getTranslations('Contact'),
    getContent('faq', locale).catch(() => null),
  ]);
  const groups = faq ? parseFaqGroups(faq.body) : [];
  const items = faq ? parseFaq(faq.body) : [];

  return (
    <>
      <section className="container-page max-w-3xl py-14">
        <h1 className="text-[clamp(2.2rem,4vw,3.2rem)] leading-tight font-medium">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t.rich('pageIntro', {
            form: (chunks) => (
              <a
                href={`#${CONTACT_ID}`}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        <div className="mt-10">
          <FaqGroups groups={groups} />
        </div>
      </section>

      {/* Contacto: un formulario, sin el mail del equipo a la vista. */}
      <section
        id={CONTACT_ID}
        aria-labelledby="contact-title"
        className="container-page grid max-w-5xl scroll-mt-28 gap-10 py-16 lg:grid-cols-[1fr_1.6fr] lg:gap-16"
      >
        <div>
          <h2
            id="contact-title"
            className="text-[clamp(1.9rem,3.3vw,2.6rem)] leading-[1.1] font-medium"
          >
            {tContact('title')}
          </h2>
          <p className="mt-4 max-w-sm text-muted-foreground">{tContact('text')}</p>
        </div>
        <ContactForm />
      </section>

      {/* Datos para buscadores (schema.org), después del contenido visible. */}
      {items.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }}
        />
      )}
    </>
  );
}
