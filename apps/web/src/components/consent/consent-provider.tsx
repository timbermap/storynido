'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { CONSENT_COOKIE, serializeConsent, type ConsentChoice } from '@/lib/consent';

interface ConsentState {
  /** null = todavía no decidió (se muestra el banner). */
  choice: ConsentChoice | null;
  preferencesOpen: boolean;
  save: (choice: ConsentChoice) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const ConsentContext = createContext<ConsentState | null>(null);

const SIX_MONTHS = 60 * 60 * 24 * 182;

export function ConsentProvider({
  initial,
  children,
}: {
  initial: ConsentChoice | null;
  children: ReactNode;
}) {
  const [choice, setChoice] = useState(initial);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const save = useCallback((next: ConsentChoice) => {
    document.cookie = `${CONSENT_COOKIE}=${serializeConsent(next)}; path=/; max-age=${String(SIX_MONTHS)}; samesite=lax`;
    setChoice(next);
    setPreferencesOpen(false);
  }, []);

  const value = useMemo<ConsentState>(
    () => ({
      choice,
      preferencesOpen,
      save,
      openPreferences: () => {
        setPreferencesOpen(true);
      },
      closePreferences: () => {
        setPreferencesOpen(false);
      },
    }),
    [choice, preferencesOpen, save],
  );

  return <ConsentContext value={value}>{children}</ConsentContext>;
}

export function useConsent(): ConsentState {
  const context = useContext(ConsentContext);
  if (!context) throw new Error('useConsent fuera de ConsentProvider');
  return context;
}
