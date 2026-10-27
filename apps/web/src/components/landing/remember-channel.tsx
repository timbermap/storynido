'use client';

import { useEffect } from 'react';

import type { Channel } from '@storynido/shared';

export const CHANNEL_STORAGE_KEY = 'storynido:channel';

/**
 * Recuerda en la sesión del navegador la línea por la que entró la visita, para abrir el
 * creador en ese modo. sessionStorage: sin cookies ni datos personales.
 */
export function RememberChannel({ channel }: { channel: Channel }) {
  useEffect(() => {
    try {
      window.sessionStorage.setItem(CHANNEL_STORAGE_KEY, channel);
    } catch {
      // Sin storage (modo privado): el creador usa el parámetro de la URL o Familias.
    }
  }, [channel]);
  return null;
}
