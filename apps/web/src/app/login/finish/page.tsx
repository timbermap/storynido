'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  authErrorMessage,
  completeMagicLink,
  isMagicLink,
  rememberedEmail,
} from '@/lib/firebase/auth-actions';

type Status = 'checking' | 'need-email' | 'signing-in' | 'invalid' | { error: string };

export default function FinishSignInPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [email, setEmail] = useState('');

  async function finish(withEmail: string) {
    setStatus('signing-in');
    try {
      await completeMagicLink(withEmail, window.location.href);
      router.replace('/cuenta');
    } catch (error) {
      setStatus({ error: authErrorMessage(error) });
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

  useEffect(() => {
    // Leer la URL y localStorage solo es posible después de montar; es una única sincronización.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void processLink();
  }, []);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void finish(email);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-12 text-center">
      {(status === 'checking' || status === 'signing-in') && (
        <p role="status" className="text-muted-foreground">
          Iniciando sesión…
        </p>
      )}
      {status === 'invalid' && (
        <p role="alert">
          Este enlace no es válido.{' '}
          <a href="/login" className="underline">
            Pedí uno nuevo
          </a>
          .
        </p>
      )}
      {status === 'need-email' && (
        <form className="grid gap-3 text-left" onSubmit={onSubmit}>
          <label htmlFor="email" className="text-sm font-medium">
            Confirmá tu email para terminar de entrar
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
            className="h-10 rounded-md border bg-background px-3 text-base"
          />
          <Button type="submit" size="lg">
            Entrar
          </Button>
        </form>
      )}
      {typeof status === 'object' && (
        <p role="alert">
          {status.error}{' '}
          <a href="/login" className="underline">
            Volver
          </a>
        </p>
      )}
    </main>
  );
}
