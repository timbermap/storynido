'use client';

import { ImageSlot } from '@/components/landing/image-slot';
import { CoverTitle } from '@/components/stories/story-cover';
import { useEffect, useId, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { readVisitorName, saveVisitorName } from '@/lib/visitor-name';

const MAX_NAME = 14;

export interface NameCoverLabels {
  title: string;
  subtitle: string;
  label: string;
  defaultName: string;
  line1: string;
  line3: string;
  sample: string;
  cta: string;
  characterCaption: string;
  storyCaption: string;
  /** El fragmento del cuento: «{name}» se reemplaza por el nombre escrito. */
  storyText: string;
}

/**
 * Portada de muestra que se personaliza en vivo con el nombre que escribe el visitante.
 * Los textos llegan del servidor para no enviar al navegador todos los de la home.
 */
export function NameCoverDemo({ labels }: { labels: NameCoverLabels }) {
  const t = (key: keyof NameCoverLabels) => labels[key];
  const id = useId();
  const [name, setName] = useState('');
  // Si ya escribió un nombre antes, la demo arranca con él (y las portadas del sitio también).
  useEffect(() => {
    const stored = readVisitorName();
    // Leer localStorage solo es posible después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setName(stored);
  }, []);
  const plain = name.trim() || t('defaultName');
  const shown = plain.toUpperCase();
  const [storyBefore = '', storyAfter = ''] = t('storyText').split('{name}');

  return (
    <section className="border-y bg-card py-20 lg:py-24">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="grid items-center gap-8 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="relative mx-auto w-[min(80%,19rem)] [perspective:1400px] sm:w-full">
              <div className="relative -rotate-3 [transform:rotateY(-10deg)]">
                <div className="[container-type:inline-size] relative aspect-[3/4] overflow-hidden rounded-[0.4rem_1rem_1rem_0.4rem] border-l-[12px] border-[#a98ac0] bg-[#fff4ea] shadow-[var(--shadow-book)]">
                  <ImageSlot
                    src="/samples/aventura-espacial.webp"
                    alt=""
                    width={1200}
                    height={1600}
                    sizes="(min-width: 1024px) 300px, 80vw"
                    tone="bg-[#26324a]"
                  />
                  <span aria-live="polite" className="contents">
                    <CoverTitle before={t('line1')} name={shown} after={t('line3')} ink="light" />
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-y-2 -right-2 w-3 rounded-r-md bg-[repeating-linear-gradient(to_bottom,#fff,#fff_3px,#efe6d6_3px,#efe6d6_4px)]"
                />
              </div>
            </div>
            <div className="mx-auto grid w-full max-w-xs gap-5 sm:max-w-none">
              <figure>
                <div className="relative overflow-hidden rounded-2xl bg-[#fff7f2] shadow-[var(--shadow-card)]">
                  <ImageSlot
                    src="/images/secciones/personaje.webp"
                    alt=""
                    width={900}
                    height={900}
                    sizes="240px"
                    tone="bg-[#fff7f2]"
                    className="aspect-[4/3] object-cover object-top"
                  />
                  <span className="absolute bottom-2 left-2 rounded-full bg-card px-3 py-1 font-display text-sm font-bold shadow-[var(--shadow-card)]">
                    {plain}
                  </span>
                </div>
                <figcaption className="mt-2 text-xs font-bold text-muted-foreground">
                  {t('characterCaption')}
                </figcaption>
              </figure>
              <figure>
                <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
                  <ImageSlot
                    src="/images/secciones/pagina-cohete.webp"
                    alt=""
                    width={1200}
                    height={900}
                    sizes="240px"
                    tone="bg-[#26324a]"
                    className="aspect-[16/9] object-cover"
                  />
                  <p
                    aria-live="polite"
                    className="px-3 py-2.5 font-serif text-[0.8rem] leading-snug"
                  >
                    {storyBefore}
                    <mark className="rounded bg-peach px-1 font-bold text-foreground">{plain}</mark>
                    {storyAfter}
                  </p>
                </div>
                <figcaption className="mt-2 text-xs font-bold text-muted-foreground">
                  {t('storyCaption')}
                </figcaption>
              </figure>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">{t('sample')}</p>
        </div>

        <div className="order-1 lg:order-2">
          <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
            {t('title')}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
          <label htmlFor={id} className="mt-8 block text-[0.91rem] font-semibold">
            {t('label')}
          </label>
          <input
            id={id}
            value={name}
            maxLength={MAX_NAME}
            autoComplete="off"
            placeholder={t('defaultName')}
            onChange={(event) => {
              setName(event.target.value);
              saveVisitorName(event.target.value);
            }}
            className="mt-2 h-14 w-full max-w-sm rounded-[0.9rem] border-[1.5px] border-[#b7bcc8] bg-card px-4 text-xl font-semibold focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d9cef0]"
          />
          <div className="mt-6">
            <Link href="/create" className={buttonVariants({ size: 'lg' })}>
              {t('cta')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
