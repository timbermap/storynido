'use client';

import { ArrowRight, Check, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { CountryCode, Locale, Offer, PublicStory } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { StoryCover } from '@/components/stories/story-cover';

import { HeroImage, heroFor } from './hero';
import { Link, useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { loadHomeData } from '@/lib/firebase/home-data';
import { formatPrice } from '@/lib/format';
import { heroName, pickHomeState, type HomeState } from '@/lib/home-state';
import { titleForChild } from '@/lib/story-title';
import { cn } from '@/lib/utils';

type Result = Awaited<ReturnType<typeof loadHomeData>>;
const translateOf = (t: ReturnType<typeof useTranslations>) =>
  t as unknown as (key: string, values?: Record<string, string | number>) => string;

const button =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-white transition-colors hover:bg-primary-hover motion-reduce:transition-none';

/**
 * Home de quien ya tiene sesión: gira alrededor de SU libro. Arriba, un hero según lo que ya hizo
 * (un solo botón que lo lleva al paso siguiente), y debajo historias, formatos, cómo sigue y tres
 * preguntas. Se pinta con el estado de la persona cuando carga; mientras tanto muestra un esqueleto
 * del hero (nunca el contenido de visitante).
 */
export function SignedInHome({
  stories,
  offer,
  country,
  christmas,
  storyCount,
  shippingEstimate,
  previewData,
}: {
  stories: PublicStory[];
  offer: Offer | null;
  country: CountryCode;
  /** Línea de Navidad (la arma el servidor: depende del país y de la fecha). */
  christmas: ReactNode;
  storyCount: number;
  /** Envío estimado de la tapa dura al país, en dólares (centavos), si se pudo calcular. */
  shippingEstimate: number | null;
  /** Datos de prueba para la página de capturas (no pasa por la sesión ni por Firestore). */
  previewData?: Result;
}) {
  const t = useTranslations('HomeSession');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user, signedIn, loading } = useAuth();
  const [data, setData] = useState<Result | null>(previewData ?? null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (previewData) return;
    if (!loading && !signedIn) router.refresh();
  }, [loading, signedIn, router, previewData]);

  useEffect(() => {
    if (previewData || !user || !signedIn) return;
    let cancelled = false;
    void getFirebaseDb()
      .then((db) => loadHomeData(db, user.uid))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData({ books: [], orders: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [user, signedIn, previewData]);

  const state: HomeState | null = useMemo(
    () => (data ? pickHomeState(data.books, data.orders) : null),
    [data],
  );
  const name = state ? heroName(state) : null;
  const money = (minor: number) => formatPrice(minor, offer?.currency ?? 'USD', locale, country);
  const digital = offer?.formats.find((format) => format.format === 'digital');
  const printed = offer?.formats.filter((format) => format.format !== 'digital') ?? [];

  // El botón del hero: a dónde lleva y qué se registra al tocarlo.
  const hero = state
    ? heroFor(
        state,
        translateOf(t),
        locale,
        name,
        digital ? money(digital.amountMinor) : null,
        typed,
      )
    : null;

  const ctaRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const node = ctaRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      // La barra fija aparece cuando el botón del hero ya quedó arriba, fuera de la pantalla.
      setStuck(!entry?.isIntersecting && (entry?.boundingClientRect.top ?? 0) < 0);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [state]);

  const railName = name ?? null;
  const tales = stories.slice(0, 4);
  const sampleStory = tales[0] ?? stories[0];

  if (!state || !hero) {
    return (
      <div className="home-session">
        <div
          className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8"
          role="status"
          aria-label={t('loading')}
        >
          <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="grid gap-4">
              <div className="h-10 w-3/4 rounded-xl bg-border" />
              <div className="h-5 w-1/2 rounded-lg bg-border" />
              <div className="h-12 w-56 rounded-xl bg-border" />
            </div>
            <div className="aspect-[396/524] w-2/3 rounded-xl bg-border lg:mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  const track = { 'data-track': 'home_hero_click', 'data-track-state': hero.trackState };
  const cta = (
    <Link
      href={hero.href}
      onClick={hero.onClick}
      className={cn(button, 'w-full sm:w-auto')}
      {...track}
    >
      {hero.cta}
      <ArrowRight className="size-5" aria-hidden="true" />
    </Link>
  );

  return (
    <div className="home-session pb-16 text-foreground">
      {/* Hero: en el celular primero la portada, después el título y el botón. */}
      <section className="mx-auto grid max-w-[1240px] gap-8 px-5 pt-6 pb-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-14 lg:pt-14 lg:pb-16">
        <div className="order-2 grid min-w-0 content-center gap-4 lg:order-1">
          {hero.pill && (
            <span className="w-fit rounded-full bg-peach px-3 py-1 text-sm font-semibold text-[#872f27]">
              {hero.pill}
            </span>
          )}
          <h1 className="text-[clamp(2.1rem,5vw,3.9rem)] leading-[1.05] text-balance">
            {hero.title}
          </h1>
          <p className="max-w-[30em] text-lg text-muted-foreground">{hero.sub}</p>

          {state.kind === 'new' && (
            <label className="grid max-w-md gap-1.5 text-sm font-semibold">
              <span className="sr-only">{t('new.nameLabel')}</span>
              <input
                value={typed}
                maxLength={14}
                placeholder={t('new.namePlaceholder')}
                onChange={(event) => {
                  setTyped(event.target.value);
                }}
                className="h-12 rounded-xl border bg-white px-4 text-base font-normal"
              />
              <span className="text-sm font-normal text-muted-foreground">
                {t('new.example', {
                  title: sampleStory
                    ? titleForChild(sampleStory, typed.trim() || 'Toto', locale)
                    : '',
                })}
              </span>
            </label>
          )}
          {state.kind === 'generating' && (
            <ol className="grid max-w-sm gap-2 text-base">
              {(['step1', 'step2', 'step3'] as const).map((step, index) => (
                <li
                  key={step}
                  className={cn(
                    'flex items-center gap-3',
                    index === 1 ? 'font-semibold' : 'text-muted-foreground',
                  )}
                >
                  {index === 0 ? (
                    <Check className="size-5 text-primary" aria-hidden="true" />
                  ) : index === 1 ? (
                    <Loader2
                      className="size-5 animate-spin text-primary motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="size-5 rounded-full border" aria-hidden="true" />
                  )}
                  {t(`generating.${step}`)}
                </li>
              ))}
            </ol>
          )}

          <div ref={ctaRef} className="grid gap-3 pt-1">
            <div>{cta}</div>
            {hero.fine && <p className="text-sm text-muted-foreground">{hero.fine}</p>}
            {state.kind !== 'order' && state.kind !== 'pro' && christmas}
          </div>
        </div>

        <div className="order-1 flex min-w-0 justify-center lg:order-2">
          <HeroImage state={state} stories={stories} typed={typed} translate={translateOf(t)} />
        </div>
      </section>

      {/* Más aventuras */}
      {tales.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[clamp(1.7rem,3vw,2.4rem)] leading-tight text-balance">
              {railName ? t('rail.title', { name: railName }) : t('rail.titleNoName')}
            </h2>
            <Link
              href="/families/stories"
              className="text-base font-semibold text-primary hover:underline"
            >
              {t('rail.all', { count: storyCount })}
            </Link>
          </div>
          <ul className="-mx-5 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
            {tales.map((story) => (
              <li key={story.slug} className="w-[58%] shrink-0 snap-start sm:w-[34%] lg:w-auto">
                <Link
                  href={{
                    pathname: '/stories/[slug]',
                    params: { slug: story.slug },
                    query: { line: 'families' },
                  }}
                  className="group grid gap-2"
                >
                  <span className="block aspect-[396/524] overflow-hidden rounded-xl transition-transform group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                    <StoryCover
                      story={story}
                      name={railName}
                      sizes="(min-width: 1024px) 280px, 58vw"
                    />
                  </span>
                  <span className="text-base leading-snug font-semibold">
                    {titleForChild(story, railName, locale)}
                  </span>
                  {digital && (
                    <span className="text-sm text-muted-foreground">
                      {t('rail.from', {
                        price: money(
                          Math.min(
                            ...(offer?.lengthPrices.map((l) => l.amountMinor) ?? [
                              digital.amountMinor,
                            ]),
                          ),
                        ),
                      })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formatos y precios reales */}
      {offer?.available && (
        <section className="bg-white py-14">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
            <Image
              src="/images/heroes/libro-impreso.webp"
              alt={t('formats.photoAlt')}
              width={1400}
              height={1045}
              unoptimized
              sizes="(min-width: 1024px) 640px, 92vw"
              className="h-auto w-full rounded-2xl"
            />
            <div>
              <h2 className="text-[clamp(1.7rem,3vw,2.4rem)] leading-tight text-balance">
                {t('formats.title')}
              </h2>
              <ul className="mt-6 border-b">
                {(['hardcover', 'softcover', 'digital'] as const).map((format) => {
                  const entry = offer.formats.find((item) => item.format === format);
                  if (!entry) return null;
                  const isPrint = format !== 'digital';
                  return (
                    <li
                      key={format}
                      className="flex items-start justify-between gap-4 border-t py-4"
                    >
                      <span>
                        <span className="block text-lg font-semibold">
                          {t(`formats.${format}`)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t(`formats.${format}Text`)}
                        </span>
                      </span>
                      <span className="font-semibold whitespace-nowrap">
                        {isPrint
                          ? t(entry.estimated ? 'formats.from' : 'formats.plusShipping', {
                              price: money(entry.amountMinor),
                            })
                          : money(entry.amountMinor)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                {t('formats.note', { pages: digital?.pageCount ?? printed[0]?.pageCount ?? 28 })}
                {shippingEstimate !== null &&
                  ` ${t('formats.estimate', { price: money(shippingEstimate) })}`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Cómo sigue */}
      <section className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8">
        <h2 className="mb-8 text-[clamp(1.7rem,3vw,2.4rem)] leading-tight">{t('how.title')}</h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {[
            {
              key: 'step1',
              src: '/images/secciones/personaje.webp',
              alt: t('how.alt1'),
              contain: true,
            },
            {
              key: 'step2',
              src: sampleStory?.coverImage ?? '',
              alt: t('how.alt2'),
              contain: false,
            },
            {
              key: 'step3',
              src: '/images/heroes/libro-impreso.webp',
              alt: t('how.alt3'),
              contain: false,
            },
          ].map((step) => (
            <li key={step.key} className="grid gap-3">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-[#e2f2ec]">
                {step.src && (
                  <Image
                    src={step.src}
                    alt={step.alt}
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 400px, 92vw"
                    className={step.contain ? 'object-contain p-3' : 'object-cover'}
                  />
                )}
              </span>
              <span>
                <span className="block text-lg font-semibold">{t(`how.${step.key}`)}</span>
                <span className="text-base text-muted-foreground">{t(`how.${step.key}Text`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Tres preguntas */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <h2 className="mb-6 text-[clamp(1.7rem,3vw,2.4rem)] leading-tight">{t('faq.title')}</h2>
          <div className="max-w-3xl">
            {(['1', '2', '3'] as const).map((n) => (
              <details key={n} className="border-t py-4 last:border-b">
                <summary className="cursor-pointer text-lg font-semibold">{t(`faq.q${n}`)}</summary>
                <p className="mt-2 text-base text-muted-foreground">{t(`faq.a${n}`)}</p>
              </details>
            ))}
            <Link
              href="/faq"
              className="mt-5 inline-block text-base font-semibold text-primary hover:underline"
            >
              {t('faq.all')}
            </Link>
          </div>
        </div>
      </section>

      {/* Barra fija abajo (celular), después de pasar el hero. */}
      {stuck && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {t(state.kind === 'preview' ? 'sticky.preview' : 'sticky.other')}
          </span>
          <Link
            href={hero.href}
            onClick={hero.onClick}
            className={cn(button, 'min-h-11 shrink-0 px-4 text-sm')}
            {...track}
          >
            {hero.cta}
          </Link>
        </div>
      )}
    </div>
  );
}
