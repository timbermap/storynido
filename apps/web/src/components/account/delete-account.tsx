'use client';

import { ApiError } from '@storynido/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { logOut } from '@/lib/firebase/auth-actions';

/** Borrar la cuenta: pide confirmación explícita; los pedidos pagados se conservan (facturación). */
export function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const t = useTranslations('Account.deleteAccount');
  const router = useRouter();
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await api('deleteAccount', { body: { confirm: true } });
      onDeleted();
      router.replace('/');
      await logOut().catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('error'));
      setDeleting(false);
    }
  }

  return (
    <details className="group rounded-2xl border border-destructive/30 p-4">
      <summary className="cursor-pointer font-semibold">{t('title')}</summary>
      <div className="mt-3 grid gap-3 text-sm">
        <p className="text-muted-foreground">{t('text')}</p>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => {
              setUnderstood(event.target.checked);
            }}
            className="mt-0.5 size-4 accent-[var(--destructive)]"
          />
          {t('understood')}
        </label>
        <Button
          variant="destructive"
          className="justify-self-start"
          disabled={!understood || deleting}
          onClick={() => void remove()}
        >
          {deleting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('confirm')}
        </Button>
        {error && (
          <p role="alert" className="font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
