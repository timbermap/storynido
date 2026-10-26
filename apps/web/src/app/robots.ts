import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.NEXT_PUBLIC_SITE_ENV === 'production';
  return {
    // Fuera de producción (staging, previews) no se indexa nada.
    rules: isProduction
      ? { userAgent: '*', allow: '/', disallow: ['/*/cuenta', '/*/account', '/*/conta'] }
      : { userAgent: '*', disallow: '/' },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
