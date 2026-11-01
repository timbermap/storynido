import { ArrowRight, Check, Clock, Gift } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Channel, PublicStory } from '@storynido/shared';

import { FaqList, type FaqItem } from '@/components/home/faq-list';
import { buttonVariants } from '@/components/ui/button';
import { AuthLink } from '@/components/auth/auth-link';
import { StoryCover } from '@/components/stories/story-cover';
import { Link } from '@/i18n/navigation';

/** Secciones compartidas por las landings de cada línea (misma estética que la home). */

export function LandingHero({
  eyebrow,
  title,
  subtitle,
  cta,
  note,
  priceLine,
  bullets,
  media,
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
}) {
  return (
    <section className="overflow-hidden">
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
}: {
  title: string;
  steps: { title: string; text: string }[];
}) {
  const tones = ['bg-secondary text-primary', 'bg-peach text-[#a33f33]', 'bg-mint text-success'];
  return (
    <section className="container-page py-20 lg:py-24">
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
    </section>
  );
}

export function LandingChecklist({
  title,
  subtitle,
  items,
  note,
}: {
  title: string;
  subtitle?: string;
  /** `tag`: lo que aclara el estado de la pieza ("Disponible hoy", "Por cotización"). */
  items: { title: string; text?: string; tag?: { label: string; available: boolean } }[];
  note?: string;
}) {
  return (
    <section className="bg-muted py-20 lg:py-24">
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">{title}</h2>
          {subtitle && <p className="mt-3 text-lg text-muted-foreground">{subtitle}</p>}
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
          <p className="mt-8 max-w-2xl text-sm font-semibold text-muted-foreground">{note}</p>
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
}: {
  /** Ancla para llegar desde un botón del hero ("Ver ejemplos"). */
  id?: string;
  title: string;
  subtitle?: string;
  collections: { slug: string; name: string; description: string; topics: string[] }[];
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
    <section id={id} className="container-page scroll-mt-28 py-20 lg:py-24">
      <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">{title}</h2>
      {subtitle && <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>}
      <ul className="mt-10 grid gap-6 lg:grid-cols-2">
        {collections.map((collection) => {
          const own = stories.filter((story) => story.collectionIds.includes(collection.slug));
          const startLabel = start ? (
            <>
              {start.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          ) : null;
          return (
            <li
              key={collection.slug}
              className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]"
            >
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
                        ? { line, tema: collection.name }
                        : { line, story: own[0]?.slug ?? '' },
                  }}
                  data-track="collection_start"
                  data-track-line={line}
                  guest={startLabel}
                  member={startLabel}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline"
                />
              )}
              {own.length > 0 && (
                <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {own.map((story) => (
                    <li key={story.slug} className="min-w-0">
                      <Link
                        // La ficha de la historia: edades, fragmento, ejemplo para hojear y precios.
                        href={{
                          pathname: '/stories/[slug]',
                          params: { slug: story.slug },
                          query: line ? { line } : undefined,
                        }}
                        aria-label={createLabel ? `${createLabel}: ${story.title}` : story.title}
                        className="group block"
                      >
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg shadow-[var(--shadow-card)] transition group-hover:-translate-y-0.5">
                          <StoryCover
                            story={story}
                            line={line}
                            sizes="(min-width: 640px) 8rem, 40vw"
                          />
                        </div>
                        <span className="mt-1.5 block text-xs leading-snug font-semibold group-hover:text-primary">
                          {story.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function LandingFaq({ title, items }: { title: string; items: FaqItem[] }) {
  return (
    <section className="container-page py-20 lg:py-24">
      <h2 className="text-center text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
        {title}
      </h2>
      <div className="mx-auto mt-10 max-w-3xl">
        <FaqList items={items} />
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
  return (
    <section className="container-page py-20">
      <div className="relative overflow-hidden rounded-2xl bg-secondary px-6 py-14 text-center sm:px-12">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 right-[8%] text-[13rem] leading-none text-primary/10"
        >
          ✦
        </span>
        <Gift className="relative mx-auto size-10 text-primary" aria-hidden="true" />
        <h2 className="relative mt-4 text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
          {title}
        </h2>
        {text && (
          <p className="relative mx-auto mt-3 max-w-xl text-lg text-muted-foreground">{text}</p>
        )}
        <div className="relative mt-8 flex justify-center">{cta}</div>
      </div>
    </section>
  );
}

export const ctaClass = buttonVariants({ size: 'lg' });
