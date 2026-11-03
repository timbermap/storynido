import { redirect } from '@/i18n/navigation';

interface Props {
  params: Promise<{ locale: string }>;
}

/** Mis pedidos vive ahora en Mis cuentos, en las solapas En curso y Terminados (opción 1 del navbar). */
export default async function MyOrdersPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: { pathname: '/my-stories', query: { estado: 'en-curso' } }, locale });
}
