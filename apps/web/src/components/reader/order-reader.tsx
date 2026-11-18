'use client';

import { ApiError } from '@storynido/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { StoryReader } from '@/components/reader/story-reader';
import { buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';

/** Baja un archivo leyendo el avance (si la respuesta trae el tamaño). */
async function fetchWithProgress(url: string, onProgress: (fraction: number) => void) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PDF ${String(response.status)}`);
  const size = Number(response.headers.get('content-length'));
  if (!response.body || !size) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(1, received / size));
  }
  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data.buffer;
}

/**
 * El visor de un pedido propio: solo el dueño, y solo cuando el PDF del libro ya está (la API lo
 * comprueba al firmar la URL). Es el mismo PDF limpio que se descarga, sin marca de agua.
 */
export function OrderReader({ orderId }: { orderId: string }) {
  const t = useTranslations('Reader');
  const { signedIn, loading } = useAuth();
  const router = useRouter();
  const [notReady, setNotReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  const load = useCallback(
    async (onProgress: (fraction: number) => void) => {
      try {
        const { url } = await api('orderDownload', {
          params: { orderId },
          query: { file: 'book' },
        });
        return await fetchWithProgress(url, onProgress);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
          setNotReady(true);
        }
        throw error;
      }
    },
    [orderId],
  );

  async function download() {
    setDownloading(true);
    try {
      const { url } = await api('orderDownload', {
        params: { orderId },
        query: { file: 'book' },
      });
      window.location.assign(url);
    } catch {
      // El visor ya muestra el error de lectura; la descarga se puede reintentar.
    } finally {
      setDownloading(false);
    }
  }

  const waiting = loading || !signedIn;
  return (
    <StoryReader
      load={load}
      storageKey={orderId}
      onDownload={notReady ? undefined : () => void download()}
      downloading={downloading}
      blocked={
        waiting ? (
          <p role="status">{t('opening')}</p>
        ) : notReady ? (
          <div className="grid gap-4">
            <p>{t('notReady')}</p>
            <Link
              href={{ pathname: '/order/[orderId]', params: { orderId } }}
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('viewOrder')}
            </Link>
          </div>
        ) : undefined
      }
    />
  );
}
