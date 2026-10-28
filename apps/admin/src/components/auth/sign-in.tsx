'use client';

import {
  GoogleAuthProvider,
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
  signInWithPopup,
  type MultiFactorError,
  type MultiFactorResolver,
} from 'firebase/auth';
import { ShieldCheck } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';
import { getFirebaseAuth } from '@/lib/firebase';

import { CodeInput } from './code-input';

const errorCode = (error: unknown) =>
  typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

/** Ingreso con Google y, si la cuenta tiene segundo factor, el código de la app autenticadora. */
export function SignIn() {
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setError(null);
    const auth = getFirebaseAuth();
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (caught) {
      if (errorCode(caught) === 'auth/multi-factor-auth-required') {
        setResolver(getMultiFactorResolver(auth, caught as MultiFactorError));
      } else if (errorCode(caught) !== 'auth/popup-closed-by-user') {
        setError('No pudimos iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const hint = resolver?.hints.find(
      (item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID,
    );
    if (!resolver || !hint) {
      setError('Esta cuenta no tiene una app autenticadora registrada.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code));
    } catch {
      setError('El código no es válido o venció. Prueba con el siguiente.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <header className="space-y-2 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold">{brand.name} · Admin</h1>
        <p className="text-sm text-muted-foreground">
          {resolver
            ? 'Escribe el código de 6 dígitos de tu app autenticadora.'
            : 'Acceso solo para el equipo, con verificación en dos pasos.'}
        </p>
      </header>
      {resolver ? (
        <form onSubmit={(event) => void verify(event)} className="grid gap-3">
          <CodeInput value={code} onChange={setCode} />
          <Button type="submit" disabled={busy || code.length !== 6}>
            Verificar
          </Button>
        </form>
      ) : (
        <Button onClick={() => void google()} disabled={busy}>
          Continuar con Google
        </Button>
      )}
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
