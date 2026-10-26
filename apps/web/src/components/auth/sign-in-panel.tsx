'use client';

import { useState, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  authErrorMessage,
  sendMagicLink,
  signInWithApple,
  signInWithGoogle,
} from '@/lib/firebase/auth-actions';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

/** Panel de inicio de sesión sin contraseñas, reutilizable en cualquier página. */
export function SignInPanel() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'busy';

  async function run(action: () => Promise<void>) {
    setStatus({ kind: 'busy' });
    try {
      await action();
      setStatus({ kind: 'idle' });
    } catch (error) {
      setStatus({ kind: 'error', message: authErrorMessage(error) });
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'busy' });
    try {
      await sendMagicLink(email);
      setStatus({ kind: 'sent', email });
    } catch (error) {
      setStatus({ kind: 'error', message: authErrorMessage(error) });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="space-y-3 text-center" role="status">
        <h2 className="text-xl font-semibold">Revisá tu correo</h2>
        <p className="text-muted-foreground">
          Te enviamos un enlace a <strong>{status.email}</strong>. Abrilo desde este mismo
          dispositivo para entrar.
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setStatus({ kind: 'idle' });
          }}
        >
          Usar otro email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => void run(signInWithGoogle)}
        >
          Continuar con Google
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => void run(signInWithApple)}
        >
          Continuar con Apple
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>

      <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
        <label htmlFor="email" className="text-sm font-medium">
          Tu email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          placeholder="nombre@ejemplo.com"
          className="h-10 rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="lg" disabled={busy}>
          Enviarme un enlace para entrar
        </Button>
        <p className="text-xs text-muted-foreground">
          Sin contraseñas: te llega un enlace de acceso por mail.
        </p>
      </form>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {status.message}
        </p>
      )}
    </div>
  );
}
