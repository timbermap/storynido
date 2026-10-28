import type { SiteConfig } from '@storynido/shared';

export const SITE_MODE_INFO: Record<SiteConfig['mode'], { label: string; text: string }> = {
  live: { label: 'En vivo', text: 'Todo abierto: crear, ver la muestra y comprar.' },
  preview_only: {
    label: 'Solo vista previa',
    text: 'Se puede crear la muestra; las compras quedan pausadas y la web lo avisa.',
  },
  maintenance: {
    label: 'Mantenimiento',
    text: 'La web muestra la pantalla de mantenimiento y la API responde 503 (los admins siguen entrando).',
  },
};
