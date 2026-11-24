import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { FollowUs } from '@/components/follow-us';
import { ShareButton } from '@/components/share-button';
import { listPosts } from '@/content/blog';
import { Link, getPathname } from '@/i18n/navigation';
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
  const [t, tFooter, posts, display] = await Promise.all([
    getTranslations('Blog'),
    getTranslations('Footer'),
    listPosts(locale),
    getDisplayCountry(locale),
  ]);

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-4xl font-medium sm:text-5xl">{t('title')}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
      <ul className="mt-10 space-y-6">
        {posts.map((post) => (
          <li key={post.slug} className="flex gap-5 rounded-xl border bg-card p-6 shadow-sm">
            <Image
              src={post.image}
              alt={post.imageAlt}
              width={96}
              height={128}
              sizes="96px"
              className="hidden h-32 w-24 shrink-0 rounded-md object-cover shadow-sm ring-1 ring-black/5 sm:block"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <time dateTime={post.date}>{formatDate(post.date, locale, display.country)}</time>
                </p>
                <ShareButton
                  compact
                  text={t('shareText', { title: post.title })}
                  url={getPathname({
                    locale,
                    href: { pathname: '/blog/[slug]', params: { slug: post.slug } },
                  })}
                  campaign={`blog-${post.slug}`}
                  label={t('shareWhatsapp')}
                  copyLabel={t('shareCopy')}
                  copiedLabel={t('shareCopied')}
                />
              </div>
              <h2 className="mt-1 text-2xl font-medium">
                <Link
                  href={{ pathname: '/blog/[slug]', params: { slug: post.slug } }}
                  className="hover:underline"
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-muted-foreground">{post.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <FollowUs lead={t('followLead')} newTab={tFooter('newTab')} />
    </div>
  );
}
