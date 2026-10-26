'use client';

import { useTranslations } from 'next-intl';

import { useAuth } from '@/components/auth/auth-provider';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export function AccountLink() {
  const t = useTranslations('Nav');
  const { signedIn } = useAuth();
  return (
    <Link
      href={signedIn ? '/account' : '/login'}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      {signedIn ? t('account') : t('signIn')}
    </Link>
  );
}
