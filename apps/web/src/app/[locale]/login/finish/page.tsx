'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useRef, useState, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import {
  authErrorKey,
  completeMagicLink,
  isMagicLink,
  rememberedEmail,
  afterLoginPath,
  type AuthErrorKey,
} from '@/lib/firebase/auth-actions';

type Status = 'checking' | 'need-email' | 'signing-in' | 'invalid' | { error: AuthErrorKey };

export default function FinishSignInPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [email, setEmail] = useState('');

  async function finish(withEmail: string) {
    setStatus('signing-in');
    try {
      await completeMagicLink(withEmail, window.location.href);
      const back = afterLoginPath();
      // La ruta guardada ya incluye el idioma: se navega sin volver a prefijarlo.
      if (back) {
        window.location.replace(back);
      } else {
        router.replace('/my-stories');
      }
    } catch (error) {
      setStatus({ error: authErrorKey(error) });
    }
  }

  // El enlace se procesa una sola vez, al montar (window no existe en el render del servidor).
  const processLink = useEffectEvent(async () => {
    if (!isMagicLink(window.location.href)) {
      setStatus('invalid');
      return;
    }
    const saved = rememberedEmail();
    if (saved) await finish(saved);
    else setStatus('need-email');
  });

  // El código del enlace es de un solo uso: no se procesa dos veces (React lo monta dos veces en desarrollo).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Leer la URL y localStorage solo es posible después de montar; es una única sincronización.
    void processLink();
  }, []);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void finish(email);
  }

  return (
    <section className="container-page flex min-h-[60vh] max-w-sm flex-col justify-center gap-6 py-12 text-center">
      {(status === 'checking' || status === 'signing-in') && (
        <p role="status" className="text-muted-foreground">
          {t('signingIn')}
        </p>
      )}
      {status === 'invalid' && (
        <p role="alert">
          {t('invalidLink')}{' '}
          <Link href="/login" className="underline">
            {t('requestNewLink')}
          </Link>
        </p>
      )}
      {status === 'need-email' && (
        <form className="grid gap-3 text-left" onSubmit={onSubmit}>
          <label htmlFor="email" className="text-sm font-medium">
            {t('confirmEmail')}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className="h-11 rounded-full border bg-card px-4 text-base"
          />
          <Button type="submit" size="lg">
            {t('enter')}
          </Button>
        </form>
      )}
      {typeof status === 'object' && (
        <p role="alert">
          {t(`errors.${status.error}`)}{' '}
          <Link href="/login" className="underline">
            {t('back')}
          </Link>
        </p>
      )}
    </section>
  );
}
