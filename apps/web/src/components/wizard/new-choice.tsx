'use client';

import { BookHeart, Cake, GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { COLLECTIONS, type Channel } from '@storynido/shared';
import { doc, getDoc } from 'firebase/firestore';

import { useAuth } from '@/components/auth/auth-provider';
import { getFirebaseDb } from '@/lib/firebase/client';

import { LineCards } from '@/components/home/session/line-cards';
import { useProStatus } from '@/components/pro/use-pro-status';
import type { LineCopy } from '@/components/home/session/parts';
import { LINE_TONE } from '@/components/wizard/drafts-list';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { HOME_CHANNELS, type HomeChannel } from '@/lib/home-state';
import { cn } from '@/lib/utils';

const OPTIONS: { line: Channel; icon: typeof BookHeart }[] = [
  { line: 'families', icon: BookHeart },
  { line: 'events', icon: Cake },
  { line: 'professionals', icon: GraduationCap },
];

/** "¿Qué quieres crear?": las tres líneas, cada una explicada en una línea (DECISIONS 115). */
export function NewChoice() {
  const t = useTranslations('Account.myStories');
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map(({ line, icon: Icon }) => (
        <li key={line}>
          <Link
            href={{ pathname: '/create', query: { line } }}
            data-track="new_choice"
            data-track-line={line}
            className="flex h-full flex-col gap-2 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40"
          >
            <span className={cn('grid size-10 place-items-center rounded-full', LINE_TONE[line])}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="font-semibold">{t(`newOptions.${line}.title`)}</span>
            <span className="text-sm text-muted-foreground">{t(`newOptions.${line}.text`)}</span>
            <span className="mt-auto pt-3">
              <span className={buttonVariants({ className: 'w-full' })}>{t('start')}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Un personaje guardado: su nombre y, si se creó en Profesionales, su alias. */
function useCharacter(characterId: string) {
  const { user } = useAuth();
  const [character, setCharacter] = useState<{ name: string; alias: string | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getFirebaseDb()
      .then((db) => getDoc(doc(db, COLLECTIONS.children, characterId)))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return;
        const alias = snapshot.get('alias') as string | null | undefined;
        setCharacter({
          name: String(snapshot.get('name') ?? ''),
          alias: alias?.trim() ? alias : null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, characterId]);
  return character;
}

/**
 * «Crear otro cuento con…»: las tres líneas, con el mismo diseño de la home con sesión (foto,
 * píldora, título y frase). Se destaca Familias. Un alumno de Profesionales (con alias, en una
 * cuenta Pro) solo ve Profesionales. El personaje llega elegido al creador.
 */
export function NewChoiceWithCharacter({
  characterId,
  lines,
}: {
  characterId: string;
  lines: LineCopy;
}) {
  const t = useTranslations('Account.myStories');
  const character = useCharacter(characterId);
  const name = character?.alias ?? character?.name ?? '';
  const { status: pro } = useProStatus();
  // Un alumno de Profesionales (con alias) en una cuenta Pro sigue en su proyecto: no se mezcla
  // con fiestas familiares. Un personaje de Familias puede ir a cualquiera de las tres líneas.
  const proStudent = Boolean(character?.alias) && pro?.accountType === 'professional';
  const order: HomeChannel[] = proStudent ? ['professionals'] : [...HOME_CHANNELS];
  const lead: HomeChannel = proStudent ? 'professionals' : 'families';
  return (
    <>
      <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1] font-bold text-balance">
        {name ? t('newWithTitle', { name }) : t('newTitle')}
      </h1>
      <LineCards
        order={order}
        lead={lead}
        heading={null}
        birthday={false}
        query={{ personaje: characterId }}
        leadCta={t('start')}
        titles={Object.fromEntries(
          order.map((line) => [line, t(`newWith.${line}.title`, { name })]),
        )}
        lines={
          Object.fromEntries(
            order.map((line) => [
              line,
              { chip: lines[line].chip, text: t(`newWith.${line}.text`, { name }) },
            ]),
          ) as LineCopy
        }
      />
    </>
  );
}
