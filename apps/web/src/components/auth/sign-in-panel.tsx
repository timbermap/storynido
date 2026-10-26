'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type SubmitEvent } from 'react';

import type { Locale } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { getPathname } from '@/i18n/navigation';
import {
  authErrorKey,
  sendMagicLink,
  signInWithApple,
  signInWithGoogle,
  type AuthErrorKey,
} from '@/lib/firebase/auth-actions';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'sent'; email: string }
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
      setStatus({ kind: 'error', key: authErrorKey(error) });
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

  if (status.kind === 'sent') {
    return (
      <div className="space-y-3 text-center" role="status">
        <h2 className="text-xl font-semibold">{t('checkEmailTitle')}</h2>
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
