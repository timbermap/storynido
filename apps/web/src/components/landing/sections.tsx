import { ArrowRight, Check, Clock, Gift } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Channel, EventType, PublicStory } from '@storynido/shared';

import { FaqList, type FaqItem } from '@/components/home/faq-list';
import { buttonVariants } from '@/components/ui/button';
import { AuthLink } from '@/components/auth/auth-link';
import { StoryCover } from '@/components/stories/story-cover';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** Secciones compartidas por las landings de cada línea (misma estética que la home). */

/**
 * Fondo de cada sección, con un rol (DECISIONS 190): crema es la base; blanco, para tarjetas; menta,
 * proceso y confianza; coral, celebración; lavanda, profesionales; navy, un momento fuerte por página.
 * Dos secciones seguidas no comparten fondo.
 */
export type SectionTone = 'cream' | 'white' | 'mint' | 'coral' | 'lavender' | 'navy';

export const BAND: Record<SectionTone, string> = {
  cream: '',
  white: 'bg-white',
  mint: 'bg-mint-soft',
  coral: 'bg-coral-soft',
  lavender: 'bg-lavender-soft',
  navy: 'bg-navy',
};

/** Título y texto de apoyo de una sección: sobre navy van claros. */
export const headingTone = (tone: SectionTone) => (tone === 'navy' ? 'text-white' : '');
export const subtleTone = (tone: SectionTone) =>
  tone === 'navy' ? 'text-white/80' : 'text-muted-foreground';

export function LandingHero({
  eyebrow,
  title,
  subtitle,
  cta,
  note,
  priceLine,
  bullets,
  media,
  tone = 'cream',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: ReactNode;
  note: string;
  /** Precio como dato, bajo el botón (opcional). */
  priceLine?: string;
  /** Qué incluye, en pocas líneas, bajo el subtítulo (opcional). */
  bullets?: string[];
  /** La imagen del hero (cada línea tiene la suya). */
  media: ReactNode;
  tone?: SectionTone;
}) {
  return (
    <section className={cn('overflow-hidden', BAND[tone])}>
      <div className="container-page grid items-center gap-8 pt-10 pb-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:pt-16 lg:pb-24">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.11em] text-primary uppercase">
            <span aria-hidden="true" className="size-2 rounded-full bg-star" />
            {eyebrow}
          </p>
          <h1 className="mt-4 text-[clamp(2.4rem,4.6vw,4.4rem)] leading-[1.08] font-medium">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[clamp(1.1rem,1.65vw,1.3rem)] leading-relaxed text-muted-foreground lg:mx-0">
            {subtitle}
          </p>
          {bullets && bullets.length > 0 && (
            <ul className="mx-auto mt-6 grid max-w-xl gap-2 text-left lg:mx-0">
              {bullets.map((line) => (
                <li key={line} className="flex items-start gap-3 font-semibold">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-mint text-success">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
            {cta}
          </div>
          {priceLine && <p className="mt-5 text-base font-bold text-foreground">{priceLine}</p>}
          <p className="mt-4 text-sm font-bold text-muted-foreground">{note}</p>
        </div>
        {media}
      </div>
    </section>
  );
}

export function LandingSteps({
  title,
  steps,
  tone = 'cream',
}: {
  title: string;
  steps: { title: string; text: string }[];
  tone?: SectionTone;
}) {
  const tones = ['bg-secondary text-primary', 'bg-peach text-[#a33f33]', 'bg-mint text-success'];
  return (
    <section className={BAND[tone]}>
      <div className="container-page py-20 lg:py-24">
        <h2 className="text-center text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
          {title}
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="relative flex flex-col items-center text-center">
              <span
                className={`grid size-14 place-items-center rounded-full font-display text-2xl font-bold ${tones[index % tones.length] ?? ''}`}
              >
                {index + 1}
              </span>
              {index < steps.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="absolute top-4 -right-5 hidden size-7 text-[#e7b9ad] md:block"
                  strokeWidth={1.5}
                />
              )}
              <h3 className="mt-5 text-2xl leading-tight font-medium">{step.title}</h3>
              <p className="mt-2 max-w-xs text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingChecklist({
  title,
  subtitle,
  items,
  note,
  tone = 'white',
}: {
  tone?: SectionTone;
  title: string;
  subtitle?: string;
  /** `tag`: lo que aclara el estado de la pieza ("Disponible hoy", "Por cotización"). */
  items: { title: string; text?: string; tag?: { label: string; available: boolean } }[];
  note?: string;
}) {
  return (
    <section className={cn(BAND[tone], 'py-20 lg:py-24')}>
      <div className="container-page">
        <div className="max-w-2xl">
          <h2
            className={cn(
              'text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium',
              headingTone(tone),
            )}
          >
            {title}
          </h2>
          {subtitle && <p className={cn('mt-3 text-lg', subtleTone(tone))}>{subtitle}</p>}
        </div>
        <ul
          className={`mt-10 grid gap-4 sm:grid-cols-2 ${items.length === 4 ? '' : 'lg:grid-cols-3'}`}
        >
          {items.map((item) => (
            <li
              key={item.title}
              className="flex gap-3 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                  item.tag && !item.tag.available
                    ? 'bg-peach text-[#a33f33]'
                    : 'bg-mint text-success'
                }`}
              >
                {item.tag && !item.tag.available ? (
                  <Clock className="size-4" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
              </span>
              <span>
                <span className="block font-bold">{item.title}</span>
                {item.tag && (
                  <span
                    className={`mt-0.5 block text-xs font-bold ${
                      item.tag.available ? 'text-success' : 'text-[#a33f33]'
                    }`}
                  >
                    {item.tag.label}
                  </span>
                )}
                {item.text && <span className="mt-1 block text-muted-foreground">{item.text}</span>}
              </span>
            </li>
          ))}
        </ul>
        {note && (
          <p className={cn('mt-8 max-w-2xl text-sm font-semibold', subtleTone(tone))}>{note}</p>
        )}
      </div>
    </section>
  );
}

export function LandingCollections({
  id,
  title,
  subtitle,
  collections,
  stories = [],
  createLabel,
  line,
  start,
  tone = 'cream',
  continued = false,
  followed = false,
}: {
  tone?: SectionTone;
  /**
   * Sigue a otra lista de colecciones en la misma página: sin espacio arriba y con el título del
   * tamaño de un subtítulo de sección.
   */
  continued?: boolean;
  /** Le sigue otra lista de colecciones (`continued`): menos espacio abajo. */
  followed?: boolean;
  /** Ancla para llegar desde un botón del hero ("Ver ejemplos"). */
  id?: string;
  /** Sin título, la sección no repite encabezado (catálogos que ya tienen su H1). */
  title?: string;
  subtitle?: string;
  collections: {
    slug: string;
    name: string;
    description: string;
    topics: string[];
    /** Celebraciones: la ocasión de la colección (la tarjeta abre el creador con ella). */
    eventType?: EventType | null;
  }[];
  /** Historias de la línea: cada tema muestra las suyas, con enlace para empezar con ella. */
  stories?: PublicStory[];
  /** Texto del enlace accesible de cada tapa ("Ver la historia"). */
  createLabel?: string;
  /** Público de la landing: la ficha de la historia vuelve a ella y crea en su línea. */
  line?: Channel;
  /**
   * Empezar desde la tarjeta: con el tema como temática de la fiesta (Celebraciones) o con la
   * primera historia de la colección (Profesionales).
   */
  start?: { label: string; mode: 'theme' | 'story' };
}) {
  if (collections.length === 0) return null;
  return (
    <section id={id} className={cn('scroll-mt-28', BAND[tone])}>
      <div
        className={cn(
          'container-page',
          title && !continued && 'pt-20 lg:pt-24',
          !title && 'pt-10',
          continued && 'pt-0',
          followed ? 'pb-8 lg:pb-10' : 'pb-20 lg:pb-24',
        )}
      >
        {title && (
          <h2
            className={cn(
              continued
                ? 'text-2xl leading-tight font-medium lg:text-3xl'
                : 'text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium',
              headingTone(tone),
            )}
          >
            {title}
          </h2>
        )}
        {title && subtitle && (
          <p className={cn('mt-3 max-w-2xl text-lg', subtleTone(tone))}>{subtitle}</p>
        )}
        <ul
          className={cn(
            '-mx-4 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0',
            // Sin encabezado propio, el espacio de arriba ya lo da el padding de la sección.
            title && (continued ? 'mt-5' : 'mt-10'),
          )}
        >
          {collections.map((collection) => {
            const own = stories.filter((story) => story.collectionIds.includes(collection.slug));
            const startLabel = start ? (
              <>
                {start.label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            ) : null;
            const storyHref = (slug: string) => ({
              pathname: '/stories/[slug]' as const,
              params: { slug },
              query: line ? { line } : undefined,
            });
            const text = (
              <>
                <h3 className="text-2xl font-medium">{collection.name}</h3>
                <p className="mt-2 text-muted-foreground">{collection.description}</p>
                {collection.topics.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {collection.topics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-primary"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                )}
                {start && line && (start.mode === 'theme' || own[0]) && (
                  <AuthLink
                    href={{
                      pathname: '/create',
                      query:
                        start.mode === 'theme'
                          ? {
                              line,
                              // La temática trae la historia; la ocasión (comunión, graduación…)
                              // llega ya elegida al creador.
                              tema: collection.name,
                              ...(collection.eventType ? { ocasion: collection.eventType } : {}),
                            }
                          : { line, story: own[0]?.slug ?? '' },
                    }}
                    data-track="collection_start"
                    data-track-line={line}
                    guest={startLabel}
                    member={startLabel}
                    className="mt-auto inline-flex min-h-11 items-center gap-2 self-start pt-5 font-semibold text-primary underline-offset-4 hover:underline"
                  />
                )}
              </>
            );
            // Todas las tarjetas con el mismo orden y el mismo alto: arriba el estante de tapas
            // (cada tapa del mismo tamaño, tenga el tema 1, 2 o 3 historias; con más, el estante se
            // desliza de costado), después el texto y el botón siempre al pie.
            return (
              <li
                key={collection.slug}
                className="flex w-[85%] shrink-0 snap-start flex-col rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] sm:w-[60%] lg:w-auto"
              >
                {own.length > 0 && (
                  <ul
                    className={cn(
                      'mb-5 flex snap-x scroll-px-3 gap-2.5 rounded-lg bg-muted p-3 sm:scroll-px-4 sm:gap-3 sm:p-4',
                      own.length > 3 ? 'overflow-x-auto' : 'justify-center',
                    )}
                  >
                    {own.map((story) => (
                      <li key={story.slug} className="w-[31%] max-w-[9.5rem] shrink-0 snap-start">
                        <Link
                          // La ficha de la historia: edades, fragmento, ejemplo para hojear y precios.
                          href={storyHref(story.slug)}
                          aria-label={createLabel ? `${createLabel}: ${story.title}` : story.title}
                          title={story.title}
                          className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <div className="aspect-[3/4] w-full overflow-hidden rounded-lg shadow-[var(--shadow-card)] transition group-hover:-translate-y-0.5">
                            <StoryCover
                              story={story}
                              line={line}
                              sizes="(min-width: 1024px) 9.5rem, 25vw"
                            />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex min-w-0 flex-1 flex-col">{text}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function LandingFaq({
  title,
  items,
  tone = 'cream',
}: {
  title: string;
  items: FaqItem[];
  tone?: SectionTone;
}) {
  return (
    <section className={BAND[tone]}>
      <div className="container-page py-20 lg:py-24">
        <h2 className="text-center text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
          {title}
        </h2>
        <div className="mx-auto mt-10 max-w-3xl">
          <FaqList items={items} />
        </div>
      </div>
    </section>
  );
}

/**
 * Cierre de las cuatro landings (home, Familias, Celebraciones y Profesionales): la misma banda con
 * el mismo botón, y un título y un texto propios de cada una.
 */
export function LandingFinalCta({
  title,
  text,
  cta,
}: {
  title: string;
  text?: string;
  cta: ReactNode;
}) {
  // Banda terracota a todo el ancho con el botón en blanco: el mismo cierre que las redes.
  return (
    <section className="bg-primary text-white">
      <div className="container-page relative overflow-hidden py-20 text-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 right-[8%] text-[13rem] leading-none text-white/10"
        >
          ✦
        </span>
        <Gift className="relative mx-auto size-10" aria-hidden="true" />
        <h2 className="relative mt-4 text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium text-white">
          {title}
        </h2>
        {text && <p className="relative mx-auto mt-3 max-w-xl text-lg text-white/85">{text}</p>}
        <div className="relative mt-8 flex justify-center [&_a]:bg-white [&_a]:text-primary [&_a:hover]:bg-white/90">
          {cta}
        </div>
      </div>
    </section>
  );
}

export const ctaClass = buttonVariants({ size: 'lg' });
