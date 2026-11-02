import {
  BadgePercent,
  ChartColumn,
  ClipboardCheck,
  MessageSquareQuote,
  Plug,
  ShieldUser,
  ShoppingBag,
  Users,
  BookOpen,
  BriefcaseBusiness,
  Cake,
  Cpu,
  FileText,
  Library,
  Lightbulb,
  Palette,
  SlidersHorizontal,
  Gauge,
  Globe,
  History,
  Power,
  Sparkles,
  Tag,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

export const AREAS = [
  'Producción',
  'Logística',
  'Atención',
  'Marketing',
  'Administración',
  'Contenido',
  'Sistema',
] as const;
export type Area = (typeof AREAS)[number];

export interface NavItem {
  href:
    | '/'
    | '/orders'
    | '/order'
    | '/review'
    | '/customers'
    | '/customer'
    | '/quotes'
    | '/quality'
    | '/staff'
    | '/integrations'
    | '/site'
    | '/countries'
    | '/prices'
    | '/coupons'
    | '/promotions'
    | '/event-pricing'
    | '/pro-discounts'
    | '/stories'
    | '/collections'
    | '/styles'
    | '/lessons'
    | '/editorial'
    | '/content'
    | '/ai'
    | '/ai-models'
    | '/audit';
  label: string;
  /** Área de trabajo: agrupa el menú por la pregunta que responde cada perfil. */
  area: Area | null;
  /** Palabras extra para la búsqueda. */
  keywords: string;
  icon: LucideIcon;
}

/** Secciones del panel. Las de las etapas siguientes se suman acá. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', area: null, label: 'Resumen', keywords: 'dashboard inicio ventas', icon: Gauge },
  {
    href: '/orders',
    area: 'Logística',
    label: 'Pedidos',
    keywords: 'compras reembolso imprenta pipeline',
    icon: ShoppingBag,
  },
  {
    href: '/review',
    area: 'Producción',
    label: 'Revisión manual',
    keywords: 'qa calidad cola aprobar',
    icon: ClipboardCheck,
  },
  {
    href: '/customers',
    area: 'Atención',
    label: 'Clientes',
    keywords: 'usuarios privacidad borrado pro',
    icon: Users,
  },
  {
    href: '/quotes',
    area: 'Atención',
    label: 'Cotizaciones',
    keywords: 'eventos impresos pedidos',
    icon: MessageSquareQuote,
  },
  {
    href: '/quality',
    area: 'Producción',
    label: 'Calidad y canales',
    keywords: 'métricas qa imprenta canales',
    icon: ChartColumn,
  },
  {
    href: '/site',
    area: 'Sistema',
    label: 'Sitio',
    keywords: 'modo mantenimiento vista previa en vivo',
    icon: Power,
  },
  {
    href: '/countries',
    area: 'Administración',
    label: 'Países',
    keywords: 'impuestos envío moneda idioma',
    icon: Globe,
  },
  {
    href: '/prices',
    area: 'Administración',
    label: 'Precios y márgenes',
    keywords: 'productos formatos extensión pro margen costo',
    icon: Tag,
  },
  {
    href: '/coupons',
    area: 'Marketing',
    label: 'Cupones',
    keywords: 'códigos descuento',
    icon: Ticket,
  },
  {
    href: '/promotions',
    area: 'Marketing',
    label: 'Promociones',
    keywords: 'descuento fechas campaña',
    icon: BadgePercent,
  },
  {
    href: '/event-pricing',
    area: 'Administración',
    label: 'Eventos',
    keywords: 'kit cumpleaños piezas precio',
    icon: Cake,
  },
  {
    href: '/pro-discounts',
    area: 'Marketing',
    label: 'Descuentos por volumen',
    keywords: 'descuento volumen recurrencia escalones pro profesionales',
    icon: BriefcaseBusiness,
  },
  {
    href: '/stories',
    area: 'Contenido',
    label: 'Historias',
    keywords: 'plantillas prompts temáticas',
    icon: BookOpen,
  },
  {
    href: '/collections',
    area: 'Contenido',
    label: 'Colecciones',
    keywords: 'categorías temas líneas',
    icon: Library,
  },
  {
    href: '/styles',
    area: 'Contenido',
    label: 'Estilos',
    keywords: 'ilustración imagen',
    icon: Palette,
  },
  {
    href: '/lessons',
    area: 'Contenido',
    label: 'Enseñanzas',
    keywords: 'mensajes valores',
    icon: Lightbulb,
  },
  {
    href: '/editorial',
    area: 'Contenido',
    label: 'Opciones editoriales',
    keywords: 'extensiones densidad niveles tipos páginas',
    icon: SlidersHorizontal,
  },
  {
    href: '/content',
    area: 'Contenido',
    label: 'Contenido',
    keywords: 'legales faq banner textos',
    icon: FileText,
  },
  {
    href: '/ai',
    area: 'Producción',
    label: 'IA',
    keywords: 'modelos proveedor presupuesto regeneraciones',
    icon: Sparkles,
  },
  {
    href: '/ai-models',
    area: 'Sistema',
    label: 'Modelos de IA',
    keywords: 'catálogo precios política datos fotos',
    icon: Cpu,
  },
  {
    href: '/staff',
    area: 'Sistema',
    label: 'Usuarios del panel',
    keywords: 'roles admin superadmin',
    icon: ShieldUser,
  },
  {
    href: '/integrations',
    area: 'Sistema',
    label: 'Integraciones',
    keywords: 'proveedores conexión prueba',
    icon: Plug,
  },
  {
    href: '/audit',
    area: 'Sistema',
    label: 'Auditoría',
    keywords: 'cambios historial registro',
    icon: History,
  },
];

export function searchNav(query: string): readonly NavItem[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => {
    const text = `${item.label} ${item.keywords}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
