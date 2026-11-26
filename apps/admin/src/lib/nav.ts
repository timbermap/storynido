import {
  Award,
  BadgePercent,
  ChartColumn,
  Radar,
  Share2,
  ClipboardCheck,
  MessageSquareQuote,
  Plug,
  Wallet,
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
  LayoutDashboard,
  Globe,
  History,
  Power,
  Printer,
  Sparkles,
  Tag,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

export const AREAS = [
  'General',
  'Marketing',
  'Operaciones',
  'Administración',
  'Usuarios',
  'Contenido',
  'Sistema',
] as const;
export type Area = (typeof AREAS)[number];

export interface NavItem {
  href:
    | '/'
    | '/areas/marketing'
    | '/areas/operaciones'
    | '/areas/administracion'
    | '/areas/usuarios'
    | '/areas/contenido'
    | '/areas/sistema'
    | '/orders'
    | '/order'
    | '/review'
    | '/customers'
    | '/customer'
    | '/quotes'
    | '/quality'
    | '/traffic'
    | '/social'
    | '/analytics'
    | '/staff'
    | '/integrations'
    | '/site'
    | '/countries'
    | '/prices'
    | '/print-options'
    | '/paypal'
    | '/coupons'
    | '/promotions'
    | '/event-pricing'
    | '/pro-discounts'
    | '/stories'
    | '/collections'
    | '/styles'
    | '/showcase'
    | '/lessons'
    | '/editorial'
    | '/content'
    | '/ai'
    | '/ai-models'
    | '/audit';
  label: string;
  /** Área de trabajo: aparece en la barra superior; el menú vertical muestra solo las de esa área. */
  area: Area;
  /** Palabras extra para la búsqueda. */
  keywords: string;
  icon: LucideIcon;
}

/** Secciones del panel. Las de las etapas siguientes se suman acá. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/areas/marketing',
    area: 'Marketing',
    label: 'Resumen',
    keywords: 'portada resumen marketing números avisos',
    icon: LayoutDashboard,
  },
  {
    href: '/areas/operaciones',
    area: 'Operaciones',
    label: 'Resumen',
    keywords: 'portada resumen operaciones números avisos',
    icon: LayoutDashboard,
  },
  {
    href: '/areas/administracion',
    area: 'Administración',
    label: 'Resumen',
    keywords: 'portada resumen administración números avisos',
    icon: LayoutDashboard,
  },
  {
    href: '/areas/usuarios',
    area: 'Usuarios',
    label: 'Resumen',
    keywords: 'portada resumen usuarios números avisos',
    icon: LayoutDashboard,
  },
  {
    href: '/areas/contenido',
    area: 'Contenido',
    label: 'Resumen',
    keywords: 'portada resumen contenido números avisos',
    icon: LayoutDashboard,
  },
  {
    href: '/areas/sistema',
    area: 'Sistema',
    label: 'Resumen',
    keywords: 'portada resumen sistema números avisos',
    icon: LayoutDashboard,
  },
  {
    href: '/',
    area: 'General',
    label: 'Hoy',
    keywords: 'dashboard inicio resumen ventas contribución avisos',
    icon: Gauge,
  },
  {
    href: '/orders',
    area: 'Administración',
    label: 'Pedidos',
    keywords: 'compras reembolso imprenta pipeline',
    icon: ShoppingBag,
  },
  {
    href: '/review',
    area: 'Operaciones',
    label: 'Revisión manual',
    keywords: 'qa calidad cola aprobar',
    icon: ClipboardCheck,
  },
  {
    href: '/customers',
    area: 'Usuarios',
    label: 'Clientes',
    keywords: 'usuarios privacidad borrado pro',
    icon: Users,
  },
  {
    href: '/quotes',
    area: 'Usuarios',
    label: 'Cotizaciones',
    keywords: 'eventos impresos pedidos',
    icon: MessageSquareQuote,
  },
  {
    href: '/quality',
    area: 'Operaciones',
    label: 'Calidad y canales',
    keywords: 'métricas qa imprenta canales',
    icon: ChartColumn,
  },
  {
    href: '/traffic',
    area: 'Marketing',
    label: 'Visitas y campañas',
    keywords:
      'tráfico analítica utm redes whatsapp instagram tiktok facebook países embudo fuentes',
    icon: Radar,
  },
  {
    href: '/social',
    area: 'Marketing',
    label: 'Redes sociales',
    keywords:
      'instagram facebook tiktok pinterest seguidores alcance impresiones clics redes sociales estadísticas marketing',
    icon: Share2,
  },
  {
    href: '/analytics',
    area: 'Marketing',
    label: 'Google Analytics',
    keywords: 'google analytics ga4 usuarios sesiones fuentes países embudo compras ingresos',
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
    label: 'Países e impuestos',
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
    href: '/paypal',
    area: 'Administración',
    label: 'Cobros PayPal',
    keywords:
      'paypal pagos billetera wallet saldo comisión neto reembolsos disputas retiros conciliación',
    icon: Wallet,
  },
  {
    href: '/print-options',
    area: 'Operaciones',
    label: 'Imprentas',
    keywords: 'costo producción imprenta gelato lulu cloudprinter plazo matriz',
    icon: Printer,
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
    href: '/showcase',
    area: 'Contenido',
    label: 'Ejemplos de la mesa',
    keywords: 'golden set jueces libro real muestra aprobar publicar',
    icon: Award,
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
    label: 'Textos del sitio',
    keywords: 'legales faq banner textos',
    icon: FileText,
  },
  {
    href: '/ai',
    area: 'Operaciones',
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
    area: 'Usuarios',
    label: 'Equipo del panel',
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

/** Orden de las secciones dentro de cada área (el menú vertical). */
const ORDER: readonly NavItem['href'][] = [
  '/',
  '/areas/marketing',
  '/traffic',
  '/social',
  '/analytics',
  '/coupons',
  '/promotions',
  '/pro-discounts',
  '/areas/operaciones',
  '/review',
  '/quality',
  '/print-options',
  '/ai',
  '/areas/administracion',
  '/orders',
  '/paypal',
  '/prices',
  '/event-pricing',
  '/countries',
  '/areas/usuarios',
  '/customers',
  '/quotes',
  '/staff',
  '/areas/contenido',
  '/stories',
  '/collections',
  '/styles',
  '/showcase',
  '/lessons',
  '/editorial',
  '/content',
  '/areas/sistema',
  '/site',
  '/ai-models',
  '/integrations',
  '/audit',
];

export function itemsOfArea(area: Area): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.area === area).sort(
    (a, b) => ORDER.indexOf(a.href) - ORDER.indexOf(b.href),
  );
}

/** Pantallas de detalle que viven dentro de otra sección. */
const DETAIL_PARENT: Record<string, NavItem['href']> = {
  '/order': '/orders',
  '/customer': '/customers',
};

export function areaOfPath(pathname: string): Area {
  const path = pathname.replace(/\/$/, '') || '/';
  const href = DETAIL_PARENT[path] ?? path;
  return NAV_ITEMS.find((item) => item.href === href)?.area ?? 'General';
}

/** Área donde se muestra un aviso de la portada «Hoy». */
export function areaOfAttention(kind: string): Area {
  switch (kind) {
    case 'payment_mismatch':
    case 'payment_dispute':
      return 'Administración';
    case 'quote':
      return 'Usuarios';
    case 'alert':
      return 'General';
    default:
      return 'Operaciones';
  }
}

export function searchNav(query: string): readonly NavItem[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => {
    const text = `${item.label} ${item.keywords}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
