'use client';

import { BookHeart, Cake, GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { COLLECTIONS, type Channel } from '@storynido/shared';
import { doc, getDoc } from 'firebase/firestore';

import { useAuth } from '@/components/auth/auth-provider';
import { useProStatus } from '@/components/pro/use-pro-status';
import { getFirebaseDb } from '@/lib/firebase/client';

import { LINE_TONE } from '@/components/wizard/drafts-list';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
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
 * «Crear otro cuento con…»: qué se puede hacer con ese personaje. Un chico de Familias puede tener
 * un cuento o su cumpleaños; uno creado en Profesionales (con alias y avatar) sigue en su proyecto,
 * si la cuenta profesional está activa. El personaje llega elegido al creador.
 */
export function NewChoiceWithCharacter({ characterId }: { characterId: string }) {
  const t = useTranslations('Account.myStories');
  const character = useCharacter(characterId);
  const { status: pro } = useProStatus();
  const professional = Boolean(character?.alias) && pro?.accountType === 'professional';
  const lines: Channel[] = professional ? ['professionals'] : ['families', 'events'];
  const name = character?.alias ?? character?.name ?? '';
  return (
    <>
      <h1 className="text-3xl font-medium sm:text-4xl">
        {name ? t('newWithTitle', { name }) : t('newTitle')}
      </h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {lines.map((line) => {
          const Icon = OPTIONS.find((option) => option.line === line)?.icon ?? BookHeart;
          return (
            <li key={line}>
              <Link
                href={{ pathname: '/create', query: { line, personaje: characterId } }}
                data-track="new_choice"
                data-track-line={line}
                className="flex h-full flex-col gap-2 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40"
              >
                <span
                  className={cn('grid size-10 place-items-center rounded-full', LINE_TONE[line])}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-semibold">{t(`newWith.${line}.title`)}</span>
                <span className="text-sm text-muted-foreground">
                  {t(`newWith.${line}.text`, { name })}
                </span>
                <span className="mt-auto pt-3">
                  <span className={buttonVariants({ className: 'w-full' })}>{t('start')}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
