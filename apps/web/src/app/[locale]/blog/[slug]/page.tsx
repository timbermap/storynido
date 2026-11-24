import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { JsonLd } from '@/components/json-ld';
import { ShareButton } from '@/components/share-button';
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
      images: [{ url: absoluteUrl(post.metadata.image), width: 1200, height: 1600 }],
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
          image: absoluteUrl(post.metadata.image),
          inLanguage: locale,
          publisher: { '@type': 'Organization', name: brand.name },
        }}
      />
      <Link
        href="/blog"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('back')}
      </Link>
      <h1 className="mt-6 text-4xl font-medium sm:text-5xl">{post.metadata.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t('published', { date: formatDate(post.metadata.date, locale, display.country) })}
      </p>
      <Image
        src={post.metadata.image}
        alt={post.metadata.imageAlt}
        width={600}
        height={800}
        sizes="(min-width: 640px) 16rem, 60vw"
        priority
        className="mx-auto mt-8 h-auto w-3/5 max-w-64 rounded-lg shadow-lg ring-1 ring-black/5 sm:float-right sm:mt-2 sm:mb-4 sm:ml-8 sm:w-64"
      />
      <div className="prose prose-lg mt-8 max-w-none prose-stone prose-headings:font-display prose-a:text-primary">
        <Content />
      </div>
      <div className="mt-10 grid gap-2 border-t pt-6">
        <p className="text-sm font-semibold">{t('shareLead')}</p>
        <ShareButton
          text={t('shareText', { title: post.metadata.title })}
          url={getPathname({ locale, href: { pathname: '/blog/[slug]', params: { slug } } })}
          campaign={`blog-${slug}`}
          label={t('shareWhatsapp')}
          copyLabel={t('shareCopy')}
          copiedLabel={t('shareCopied')}
        />
      </div>
    </article>
  );
}
