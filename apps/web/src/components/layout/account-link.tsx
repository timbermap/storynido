'use client';

import { useTranslations } from 'next-intl';

import { useAuth } from '@/components/auth/auth-provider';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export function AccountLink() {
  const t = useTranslations('Nav');
  const { user } = useAuth();
  return (
    <Link
      href={user ? '/account' : '/login'}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      {user ? t('account') : t('signIn')}
    </Link>
  );
}
