import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

/**
 * "¿Para quién es?": la puerta de entrada a la landing de cada público (Familias, Cumpleaños y
 * Profesionales). Cada tarjeta lleva la misma imagen que la home con sesión de ese público (fotos
 * de muestra, nunca libros de clientes): arriba en escritorio y miniatura a la izquierda en el
 * celular para no alargar la página. Son decorativas (alt vacío): el título ya dice a dónde lleva.
 */
export async function AudienceSelector() {
  const t = await getTranslations('Home.audience');
  const audiences = [
    {
      key: 'families',
      href: '/families',
      image: '/images/heroes/familias-pagina.webp',
      focus: 'object-[50%_25%]',
      card: 'bg-[#e4f3ef]',
      ring: 'border-[#2f6f66]/30 text-[#2f6f66]',
    },
    {
      key: 'events',
      href: '/events',
      image: '/images/heroes/kit-completo.webp',
      focus: 'object-center',
      card: 'bg-[#ffe7df]',
      ring: 'border-[#a33f33]/30 text-[#a33f33]',
    },
    {
      key: 'professionals',
      href: '/professionals',
      image: '/images/heroes/pro-mesa.webp',
      focus: 'object-[50%_60%]',
      card: 'bg-[#eee8fa]',
      ring: 'border-[#5b4a99]/30 text-[#5b4a99]',
    },
  ] as const;

  return (
    <section aria-labelledby="audience" className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-16 rounded-t-[50%_100%] bg-white"
      />
      <div className="relative bg-white pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="container-page">
          <div className="mx-auto max-w-2xl pb-8 text-center">
            <h2
              id="audience"
              className="scroll-mt-28 text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium"
            >
              {t('title')}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {audiences.map(({ key, href, image, focus, card, ring }) => (
              <li key={key}>
                <Link
                  href={href}
                  data-track="persona_selected"
                  data-track-persona={key}
                  className={`group flex h-full items-center gap-4 rounded-[1.75rem] p-3 pr-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] md:flex-wrap md:items-start md:gap-y-5 md:pb-6 ${card}`}
                >
                  <span className="relative size-24 shrink-0 overflow-hidden rounded-[1.15rem] shadow-[0_10px_20px_-10px_rgb(38_50_74/0.4)] md:aspect-[16/10] md:size-auto md:w-full md:basis-full md:rounded-[1.25rem]">
                    <Image
                      src={image}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 400px, 96px"
                      className={`object-cover transition duration-500 group-hover:scale-[1.03] ${focus}`}
                    />
                  </span>
                  <span className="grid flex-1 gap-1 md:pl-3">
                    <span className="font-display text-[1.45rem] leading-tight font-semibold">
                      {t(`${key}.title`)}
                    </span>
                    <span className="text-[0.95rem] leading-snug text-muted-foreground">
                      {t(`${key}.text`)}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid size-10 shrink-0 place-items-center rounded-full border-2 bg-white/60 transition group-hover:translate-x-0.5 md:mt-1 md:mr-3 ${ring}`}
                  >
                    <ChevronRight className="size-5" />
                  </span>
                  <span className="sr-only">{t(`${key}.cta`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
