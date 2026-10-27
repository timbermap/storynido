import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { Markdown } from '@/components/markdown';
import { formatDate } from '@/lib/format';
import { LEGAL_SLUGS, legalDocumentFromSlug } from '@/lib/legal';
import { localizedAlternates } from '@/lib/seo';
import { getContent } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string; document: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, document } = await params;
  const locale = rawLocale as Locale;
  const doc = legalDocumentFromSlug(locale, document);
  if (!doc) return {};
  const t = await getTranslations({ locale, namespace: 'Legal' });
  return {
    title: t(doc),
    alternates: localizedAlternates(locale, (target) => ({
      pathname: '/legal/[document]',
      params: { document: LEGAL_SLUGS[target][doc] },
    })),
  };
}

export default async function LegalPage({ params }: Props) {
  const { locale: rawLocale, document } = await params;
  const locale = rawLocale as Locale;
  const doc = legalDocumentFromSlug(locale, document);
  if (!doc) notFound();

  const [content, t, display] = await Promise.all([
    getContent(doc, locale),
    getTranslations('Legal'),
    getDisplayCountry(locale),
  ]);
  if (!content) notFound();

  return (
    <article className="container-page max-w-3xl py-14">
      <h1 className="text-4xl font-medium">{content.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('updated', { date: formatDate(content.updatedAt, locale, display.country) })}
      </p>
      <Markdown className="mt-8">{content.body}</Markdown>
    </article>
  );
}
