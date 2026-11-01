'use client';

import { useEffect } from 'react';

import { reportClientError } from '@/lib/client-errors';

/** Escucha los errores no atrapados del navegador y los manda a nuestro log. */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Errores de extensiones o de scripts de otros orígenes no traen datos útiles.
      if (event.error) reportClientError(event.error, 'window');
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      reportClientError(event.reason, 'promise');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
