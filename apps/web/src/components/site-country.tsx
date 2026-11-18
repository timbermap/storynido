'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { CountryCode } from '@storynido/shared';

const SiteCountryContext = createContext<CountryCode | null>(null);

/** País con el que el sitio muestra precios en esta visita (elegido a mano o por la ubicación). */
export function SiteCountryProvider({
  country,
  children,
}: {
  country: CountryCode;
  children: ReactNode;
}) {
  return <SiteCountryContext value={country}>{children}</SiteCountryContext>;
}

export function useSiteCountry(): CountryCode | null {
  return useContext(SiteCountryContext);
}
