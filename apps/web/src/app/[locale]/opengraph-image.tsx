import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

import { brand } from '@/lib/brand';
import { routing } from '@/i18n/routing';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Se genera una sola vez por idioma al compilar. Antes se dibujaba en cada visita del
 * rastreador de Google y a veces el contenedor cortaba la conexión (503 en producción).
 */
export const dynamic = 'force-static';
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Imagen al compartir el sitio en redes (se genera por idioma). */
export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.hero' });
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: 'linear-gradient(135deg, #fffaf5 0%, #ffe7b0 100%)',
        color: '#2b2233',
      }}
    >
      {/* Un solo hijo de texto: satori exige display:flex si un div tiene varios hijos. El glifo ✦
          se quitó porque obligaba a descargar una fuente en cada petición (y fallaba). */}
      <div style={{ fontSize: 40, fontWeight: 800, color: '#a33f33' }}>{brand.name}</div>
      <div
        style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, marginTop: 24, maxWidth: 900 }}
      >
        {t('title')}
      </div>
      <div style={{ fontSize: 32, marginTop: 28, maxWidth: 900, color: '#555c6e' }}>
        {t('eyebrow')}
      </div>
    </div>,
    size,
  );
}
