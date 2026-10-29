import { Ban, Clock, Lock, UserRound } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { Link } from '@/i18n/navigation';
import { LEGAL_SLUGS } from '@/lib/legal';

/** "Qué hacemos con la foto": la duda que más frena a quien compra (AUDITORIA-PRODUCTO §1, punto 10). */
export async function PhotoPromise() {
  const [t, locale] = await Promise.all([getTranslations('PhotoPromise'), getLocale()]);
  const points = [
    { icon: Lock, text: t('encrypted') },
    { icon: Clock, text: t('deleted') },
    { icon: Ban, text: t('noTraining') },
    { icon: UserRound, text: t('noPhoto') },
  ];
  return (
    <section className="container-page py-16 lg:py-20">
      <div className="rounded-2xl border bg-card p-8 shadow-[var(--shadow-card)] sm:p-10">
        <h2 className="text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.15] font-medium">
          {t('title')}
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint text-success">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>
        <Link
          href={{
            pathname: '/legal/[document]',
            params: { document: LEGAL_SLUGS[locale as Locale].privacy },
          }}
          className="mt-8 inline-block font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('more')}
        </Link>
      </div>
    </section>
  );
}
