import { Gauge, History, Power, Sparkles, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: '/' | '/site' | '/ai' | '/audit';
  label: string;
  /** Palabras extra para la búsqueda. */
  keywords: string;
  icon: LucideIcon;
}

/** Secciones del panel. Las de las etapas siguientes se suman acá. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Resumen', keywords: 'dashboard inicio ventas', icon: Gauge },
  {
    href: '/site',
    label: 'Sitio',
    keywords: 'modo mantenimiento vista previa en vivo',
    icon: Power,
  },
  {
    href: '/ai',
    label: 'IA',
    keywords: 'modelos proveedor presupuesto regeneraciones',
    icon: Sparkles,
  },
  { href: '/audit', label: 'Auditoría', keywords: 'cambios historial registro', icon: History },
];

export function searchNav(query: string): readonly NavItem[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => {
    const text = `${item.label} ${item.keywords}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
