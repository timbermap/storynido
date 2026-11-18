'use client';

import type { ReactNode } from 'react';

import type { CountryCode, Locale } from '@storynido/shared';

import { AuthProvider } from '@/components/auth/auth-provider';
import { ConsentProvider } from '@/components/consent/consent-provider';
import { SiteCountryProvider } from '@/components/site-country';
import type { ConsentChoice } from '@/lib/consent';

export function Providers({
  children,
  locale,
  country,
  consent,
}: {
  children: ReactNode;
  locale: Locale;
  country: CountryCode;
  consent: ConsentChoice | null;
}) {
  return (
    <ConsentProvider initial={consent}>
      <SiteCountryProvider country={country}>
        <AuthProvider locale={locale} country={country}>
          {children}
        </AuthProvider>
      </SiteCountryProvider>
    </ConsentProvider>
  );
}
