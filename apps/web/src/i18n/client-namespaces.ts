/**
 * Mensajes que viajan al navegador: los namespaces que usan los componentes de cliente.
 * client-namespaces.test.ts falla si un componente de cliente usa uno que no está acá.
 */
export const CLIENT_NAMESPACES = [
  'Nav',
  'Loading',
  'Checkout',
  'Switchers',
  'Footer',
  'Consent',
  'Auth',
  'Account',
  'Stories',
  'Lessons',
  'Wizard',
  'HomeSession',
  'Pager',
  'Viewer',
  'Error',
  'Pro',
  'Contact',
  // «Así lo recibes» (components/formats): lo usa el creador, que es de cliente.
  'FormatShowcase',
  // El visor de cuentos comprados (components/reader).
  'Reader',
  // Barra de avance y tiempo estimado de cada generación (components/ui/generation-progress).
  'Generation',
  // Libros de ejemplo de la mesa en el visor (components/stories/showcase-book, DECISIONS 348).
  'Showcase',
];
