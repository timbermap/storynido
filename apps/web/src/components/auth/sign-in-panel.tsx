'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type SubmitEvent } from 'react';

import type { Locale } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { getPathname } from '@/i18n/navigation';
import type { MultiFactorResolver } from 'firebase/auth';

import {
  authErrorKey,
  multiFactorResolver,
  resolveWithTotp,
  sendMagicLink,
  signInWithApple,
  signInWithGoogle,
  type AuthErrorKey,
} from '@/lib/firebase/auth-actions';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'sent'; email: string }
  | { kind: 'mfa'; resolver: MultiFactorResolver; error?: AuthErrorKey }
  | { kind: 'error'; key: AuthErrorKey };

/** Panel de inicio de sesión sin contraseñas, reutilizable en cualquier página. */
export function SignInPanel() {
  const t = useTranslations('Auth');
  const locale = useLocale() as Locale;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'busy';

  async function run(action: () => Promise<void>) {
    setStatus({ kind: 'busy' });
    try {
      await action();
      setStatus({ kind: 'idle' });
    } catch (error) {
      const resolver = multiFactorResolver(error);
      setStatus(resolver ? { kind: 'mfa', resolver } : { kind: 'error', key: authErrorKey(error) });
    }
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'busy' });
    try {
      await sendMagicLink(email, getPathname({ locale, href: '/login/finish' }));
      setStatus({ kind: 'sent', email });
    } catch (error) {
      setStatus({ kind: 'error', key: authErrorKey(error) });
    }
  }

  if (status.kind === 'mfa') {
    return <TotpStep resolver={status.resolver} />;
  }

  if (status.kind === 'sent') {
    return (
      <div className="space-y-3 text-center" role="status">
        <h2 className="text-xl font-medium">{t('checkEmailTitle')}</h2>
        <p className="text-muted-foreground">{t('checkEmailText', { email: status.email })}</p>
        <Button
          variant="ghost"
          onClick={() => {
            setStatus({ kind: 'idle' });
          }}
        >
          {t('useAnotherEmail')}
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
          {t('google')}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => void run(signInWithApple)}
        >
          {t('apple')}
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t('or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
        <label htmlFor="email" className="text-sm font-medium">
          {t('emailLabel')}
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
          placeholder={t('emailPlaceholder')}
          className="h-11 rounded-full border bg-card px-4 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="lg" disabled={busy}>
          {t('sendLink')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('noPassword')}</p>
      </form>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {t(`errors.${status.key}`)}
        </p>
      )}
    </div>
  );
}

/** Segundo paso para cuentas con verificación en dos pasos: el código de la app autenticadora. */
function TotpStep({ resolver }: { resolver: MultiFactorResolver }) {
  const t = useTranslations('Auth');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resolveWithTotp(resolver, code);
    } catch (caught) {
      setError(authErrorKey(caught));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
      <h2 className="text-xl font-medium">{t('mfaTitle')}</h2>
      <label htmlFor="totp" className="text-sm text-muted-foreground">
        {t('mfaText')}
      </label>
      <input
        id="totp"
        required
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, ''));
        }}
        className="h-11 rounded-full border bg-card px-4 text-center text-lg tracking-[0.4em] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
        {t('mfaVerify')}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {t(`errors.${error}`)}
        </p>
      )}
    </form>
  );
}
