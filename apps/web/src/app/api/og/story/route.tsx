import { ImageResponse } from 'next/og';

import type { Locale } from '@storynido/shared';

import { brand } from '@/lib/brand';
import { getStory } from '@/lib/server/api';
import { absoluteUrl } from '@/lib/site';

const size = { width: 1200, height: 630 };

/**
 * Imagen al compartir una historia en WhatsApp o redes (DECISIONS 157): la portada y el título con
 * el nombre del elenco, nunca la marca "[Nombre]".
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const locale = query.get('locale') ?? 'es';
  const slug = query.get('slug') ?? '';
  // Sin la API (o con una historia que no existe) se arma la imagen de marca, sin romper al compartir.
  const story = await getStory(locale as Locale, slug).catch(() => null);
  let cover: string | null = null;
  if (story) {
    try {
      const response = await fetch(absoluteUrl(story.coverImage));
      if (response.ok) {
        const type = response.headers.get('content-type') ?? 'image/webp';
        cover = `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
      }
    } catch {
      cover = null;
    }
  }
  const parts = story?.titleParts;
  const name = story?.castName ?? '';
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: 'linear-gradient(135deg, #fff7f2 0%, #ffe7df 100%)',
        color: '#26324a',
      }}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image
        <img src={cover} alt="" width={473} height={630} style={{ objectFit: 'cover' }} />
      ) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 64,
          flex: 1,
          gap: 12,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 800, color: '#a33f33' }}>{brand.name}</div>
        {parts ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
            {parts.before ? (
              <div style={{ fontSize: 44, fontWeight: 600 }}>{parts.before}</div>
            ) : null}
            <div
              style={{ fontSize: 112, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}
            >
              {name}
            </div>
            {parts.after ? (
              <div style={{ fontSize: 44, fontWeight: 600 }}>{parts.after}</div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>{story?.title ?? ''}</div>
        )}
      </div>
    </div>,
    size,
  );
}
