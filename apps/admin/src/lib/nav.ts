import {
  BadgePercent,
  BriefcaseBusiness,
  Cake,
  Gauge,
  Globe,
  History,
  Power,
  Sparkles,
  Tag,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href:
    | '/'
    | '/site'
    | '/countries'
    | '/prices'
    | '/coupons'
    | '/promotions'
    | '/event-pricing'
    | '/pro-discounts'
    | '/ai'
    | '/audit';
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
  { href: '/countries', label: 'Países', keywords: 'impuestos envío moneda idioma', icon: Globe },
  { href: '/prices', label: 'Precios', keywords: 'productos formatos extensión pro', icon: Tag },
  { href: '/coupons', label: 'Cupones', keywords: 'códigos descuento', icon: Ticket },
  {
    href: '/promotions',
    label: 'Promociones',
    keywords: 'descuento fechas campaña',
    icon: BadgePercent,
  },
  {
    href: '/event-pricing',
    label: 'Eventos',
    keywords: 'kit cumpleaños piezas precio',
    icon: Cake,
  },
  {
    href: '/pro-discounts',
    label: 'Profesionales',
    keywords: 'descuento recurrencia escalones pro',
    icon: BriefcaseBusiness,
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
