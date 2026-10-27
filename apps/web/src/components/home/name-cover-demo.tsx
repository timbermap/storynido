'use client';

import Image from 'next/image';
import { useId, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import heroWatercolor from '../../../public/brand/hero-acuarela.webp';

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
}

/**
 * Portada de muestra que se personaliza en vivo con el nombre que escribe el visitante.
 * Los textos llegan del servidor para no enviar al navegador todos los de la home.
 */
export function NameCoverDemo({ labels }: { labels: NameCoverLabels }) {
  const t = (key: keyof NameCoverLabels) => labels[key];
  const id = useId();
  const [name, setName] = useState('');
  const shown = (name.trim() || t('defaultName')).toUpperCase();

  return (
    <section className="border-y bg-card py-20 lg:py-24">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="relative mx-auto w-[min(80%,22rem)] [perspective:1400px]">
            <div className="relative -rotate-3 [transform:rotateY(-10deg)]">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[0.4rem_1rem_1rem_0.4rem] border-l-[12px] border-[#a98ac0] bg-[#faf3ea] shadow-[var(--shadow-book)]">
                <Image
                  src={heroWatercolor}
                  alt=""
                  sizes="(min-width: 1024px) 352px, 80vw"
                  className="absolute inset-x-0 bottom-0 h-[72%] w-full object-cover object-[45%_center]"
                />
                <div className="absolute inset-x-0 top-0 h-[46%] bg-[linear-gradient(to_bottom,#faf3ea_62%,transparent)]" />
                <p className="relative px-4 pt-6 text-center font-display text-[#46335a]">
                  <span className="block text-base font-semibold sm:text-lg">{t('line1')}</span>
                  <span
                    className="block truncate text-[clamp(2rem,7vw,3.1rem)] leading-[1.05] font-bold tracking-wide text-primary"
                    aria-live="polite"
                  >
                    {shown}
                  </span>
                  <span className="block text-base font-semibold sm:text-lg">{t('line3')}</span>
                </p>
              </div>
              <div
                aria-hidden="true"
                className="absolute inset-y-2 -right-2 w-3 rounded-r-md bg-[repeating-linear-gradient(to_bottom,#fff,#fff_3px,#efe6d6_3px,#efe6d6_4px)]"
              />
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">{t('sample')}</p>
          </div>
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
            }}
            className="mt-2 h-14 w-full max-w-sm rounded-[0.9rem] border-[1.5px] border-[#b9acbf] bg-card px-4 text-xl font-semibold focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d8c1f2]"
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
