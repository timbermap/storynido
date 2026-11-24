import type { ReactNode } from 'react';

/** Íconos de redes dibujados en línea (sin marcas registradas en el bundle de íconos). */
export const SOCIAL_ICONS: Record<string, ReactNode> = {
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: (
    <>
      <path d="M13.5 3.5v11a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M13.5 3.5c.4 2.6 2.2 4.4 5 4.6" />
    </>
  ),
  pinterest: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M11 8.5c-2.4.4-3 3-1.8 4.3M10.4 17l1.5-6.4c.7 1.7 3.3 1.6 3.3-.9 0-1.6-1.3-2.6-3-2.4" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.2 9.4v5.2l4.5-2.6z" fill="currentColor" stroke="none" />
    </>
  ),
};
