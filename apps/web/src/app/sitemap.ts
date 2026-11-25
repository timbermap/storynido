import { LOCALES, LOCALE_DEFINITIONS, type Locale } from '@storynido/shared';
import type { MetadataRoute } from 'next';

import { postSlugs } from '@/content/blog';
import { getPathname } from '@/i18n/navigation';
import { OCCASION_KEYS, OCCASION_SLUGS } from '@/lib/event-occasions';
import { LEGAL_DOCUMENTS, LEGAL_SLUGS } from '@/lib/legal';
import { PERSONA_KEYS, PERSONA_SLUGS } from '@/lib/professional-personas';
import { getLessons, getStories } from '@/lib/server/api';
import { absoluteUrl } from '@/lib/site';

type Href = Parameters<typeof getPathname>[0]['href'];

/** Una entrada por página e idioma, con sus alternativas hreflang. */
function entry(hrefFor: (locale: Locale) => Href, priority: number): MetadataRoute.Sitemap {
  const urls = Object.fromEntries(
    LOCALES.map((locale) => [
      LOCALE_DEFINITIONS[locale].bcp47,
      absoluteUrl(getPathname({ locale, href: hrefFor(locale) })),
    ]),
  );
  return LOCALES.map((locale) => ({
    url: absoluteUrl(getPathname({ locale, href: hrefFor(locale) })),
    changeFrequency: 'weekly',
    priority,
    alternates: { languages: urls },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [stories, lessons] = await Promise.all([
    getStories('es').catch(() => []),
    getLessons('es').catch(() => []),
  ]);
  const posts = LOCALES.flatMap((locale) =>
    postSlugs(locale).map((slug) => ({
      url: absoluteUrl(
        getPathname({ locale, href: { pathname: '/blog/[slug]', params: { slug } } }),
      ),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  );

  return [
    ...entry(() => '/', 1),
    ...entry(() => '/families', 0.9),
    ...entry(() => '/events', 0.9),
    ...entry(() => '/professionals', 0.9),
    ...entry(() => '/stories', 0.9),
    ...entry(() => '/families/stories', 0.9),
    ...entry(() => '/how-it-works', 0.8),
    ...entry(() => '/events/themes', 0.8),
    ...OCCASION_KEYS.flatMap((key) =>
      entry(
        (locale) => ({
          pathname: '/events/themes/[occasion]',
          params: { occasion: OCCASION_SLUGS[locale][key] },
        }),
        0.8,
      ),
    ),
    ...entry(() => '/professionals/templates', 0.8),
    ...PERSONA_KEYS.flatMap((key) =>
      entry(
        (locale) => ({
          pathname: '/professionals/templates/[persona]',
          params: { persona: PERSONA_SLUGS[locale][key] },
        }),
        0.8,
      ),
    ),
    ...entry(() => '/lessons', 0.8),
    ...stories.flatMap((story) =>
      entry(() => ({ pathname: '/stories/[slug]', params: { slug: story.slug } }), 0.8),
    ),
    ...lessons.flatMap((lesson) =>
      entry(() => ({ pathname: '/lessons/[slug]', params: { slug: lesson.slug } }), 0.8),
    ),
    ...entry(() => '/faq', 0.6),
    ...entry(() => '/blog', 0.6),
    ...posts,
    ...LEGAL_DOCUMENTS.flatMap((doc) =>
      entry(
        (locale) => ({
          pathname: '/legal/[document]',
          params: { document: LEGAL_SLUGS[locale][doc] },
        }),
        0.2,
      ),
    ),
  ];
}
