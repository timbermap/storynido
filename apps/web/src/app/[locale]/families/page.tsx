import type { Locale } from '@storynido/shared';

import { permanentRedirect } from '@/i18n/navigation';

/** Familias es la home: /familias redirige a ella (una sola URL para buscadores). */
export default async function FamiliesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  permanentRedirect({ href: '/', locale });
}
