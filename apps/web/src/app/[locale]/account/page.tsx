'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@storynido/shared';

import { ChildrenList } from '@/components/account/children-list';
import { DeleteAccount } from '@/components/account/delete-account';
import { LanguagePreference } from '@/components/account/language-preference';
import { OrdersList } from '@/components/account/orders-list';
import { ProPanel } from '@/components/pro/pro-panel';
import { useProStatus } from '@/components/pro/use-pro-status';
import { DraftsList } from '@/components/wizard/drafts-list';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { logOut } from '@/lib/firebase/auth-actions';

/** Mi cuenta: pedidos en vivo, borradores, preferencias, perfiles de los chicos y borrado. */
export default function AccountPage() {
  const t = useTranslations('Account');
  const { user, signedIn, role, loading } = useAuth();
  const router = useRouter();
  const [apiCheck, setApiCheck] = useState<string>(t('verifying'));
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const tWizard = useTranslations('Wizard.drafts');
  const { status: pro } = useProStatus();
  // Al borrar la cuenta se cierra la sesión a propósito: no hay que mandar a iniciar sesión.
  const leaving = useRef(false);

  useEffect(() => {
    // La sesión anónima del creador no es una cuenta: primero hay que iniciar sesión.
    if (!loading && !signedIn && !leaving.current) router.replace('/login');
  }, [loading, signedIn, router]);

  useEffect(() => {
    if (!user) return;
    void getFirebaseDb()
      .then((db) => listDrafts(db, user.uid))
      .then((found) => {
        setDrafts(found.filter((draft) => !isEmptyDraft(draft)));
      });
  }, [user]);

  // Confirma la sesión contra la API (verifica el token en el servidor).
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api('me', { signal: controller.signal })
      .then((me) => {
        setApiCheck(t('verified', { role: t(`roles.${me.role}`) }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setApiCheck(
          error instanceof ApiError
            ? t('apiError', { message: error.message })
            : t('apiUnreachable'),
        );
      });
    return () => {
      controller.abort();
    };
  }, [user, t]);

  if (loading || !user || !signedIn) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <p role="status" className="text-muted-foreground">
          {t('loading')}
        </p>
      </section>
    );
  }

  return (
    <section className="container-page flex min-h-[60vh] max-w-2xl flex-col justify-center gap-8 py-12">
      <h1 className="text-3xl font-medium">{t('title')}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t('email')}</dt>
        <dd>{user.email ?? '—'}</dd>
        <dt className="text-muted-foreground">{t('name')}</dt>
        <dd>{user.displayName ?? '—'}</dd>
        <dt className="text-muted-foreground">{t('role')}</dt>
        <dd>{t(`roles.${role}`)}</dd>
        <dt className="text-muted-foreground">{t('api')}</dt>
        <dd role="status">{apiCheck}</dd>
      </dl>
      {pro?.accountType === 'professional' && <ProPanel uid={user.uid} status={pro} />}
      <OrdersList uid={user.uid} />
      {drafts.length > 0 && (
        <section id="drafts" className="grid scroll-mt-28 gap-4">
          <h2 className="text-2xl font-medium">{tWizard('title')}</h2>
          <DraftsList drafts={drafts} />
        </section>
      )}
      <LanguagePreference uid={user.uid} />
      <ChildrenList uid={user.uid} />
      <Button variant="outline" onClick={() => void logOut()}>
        {t('signOut')}
      </Button>
      <DeleteAccount
        onDeleted={() => {
          leaving.current = true;
        }}
      />
    </section>
  );
}
