import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { JsonLd } from '@/components/json-ld';
import { getPost } from '@/content/blog';
import { Link, getPathname } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { getDisplayCountry } from '@/lib/server/request-context';
import { absoluteUrl } from '@/lib/site';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(locale as Locale, slug);
  if (!post) return {};
  const url = absoluteUrl(
    getPathname({ locale, href: { pathname: '/blog/[slug]', params: { slug } } }),
  );
  return {
    title: post.metadata.title,
    description: post.metadata.description,
    // Cada artículo existe en un solo idioma: sin alternativas hreflang.
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: post.metadata.title,
      description: post.metadata.description,
      publishedTime: post.metadata.date,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  const [post, t, display] = await Promise.all([
    getPost(locale, slug),
    getTranslations('Blog'),
    getDisplayCountry(locale),
  ]);
  if (!post) notFound();
  const Content = post.default;

  return (
    <article className="container-page max-w-3xl py-14">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.metadata.title,
          description: post.metadata.description,
          datePublished: post.metadata.date,
          inLanguage: locale,
          publisher: { '@type': 'Organization', name: brand.name },
        }}
      />
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('back')}
      </Link>
      <h1 className="mt-6 text-4xl font-medium sm:text-5xl">{post.metadata.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t('published', { date: formatDate(post.metadata.date, locale, display.country) })}
      </p>
      <div className="prose prose-lg mt-8 max-w-none prose-stone prose-headings:font-display prose-a:text-primary">
        <Content />
      </div>
    </article>
  );
}
