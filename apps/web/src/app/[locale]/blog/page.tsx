import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { listPosts } from '@/content/blog';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { localizedAlternates } from '@/lib/seo';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Blog' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, () => '/blog'),
  };
}

export default async function BlogPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const [t, posts, display] = await Promise.all([
    getTranslations('Blog'),
    listPosts(locale),
    getDisplayCountry(locale),
  ]);

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-4xl font-semibold sm:text-5xl">{t('title')}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
      <ul className="mt-10 space-y-6">
        {posts.map((post) => (
          <li key={post.slug} className="rounded-xl border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              <time dateTime={post.date}>{formatDate(post.date, locale, display.country)}</time>
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              <Link
                href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }}
                className="hover:underline"
              >
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 text-muted-foreground">{post.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
