'use client';

import { useTranslations } from 'next-intl';

import { BookViewer, type ViewerPage } from '@/components/book/book-viewer';

/**
 * "Hojear un ejemplo": el visor del libro con lo que la historia ya tiene (portada, una
 * dedicatoria y el fragmento), sin generar nada. Si la historia tiene páginas de muestra
 * (`samplePages`), se muestran ilustradas. Todo va rotulado como ejemplo.
 */
export function StoryExample({
  title,
  coverImage,
  excerpt,
  samplePages,
}: {
  title: string;
  coverImage: string;
  excerpt: string;
  samplePages: string[];
}) {
  const t = useTranslations('Stories');
  const pages: ViewerPage[] = [
    { key: 'cover', kind: 'cover', imageUrl: coverImage, text: null },
    { key: 'dedication', kind: 'dedication', imageUrl: null, text: t('exampleDedication') },
    {
      key: 'page-1',
      kind: 'story',
      imageUrl: samplePages[0] ?? null,
      text: excerpt,
      number: 1,
    },
    ...samplePages.slice(1).map((imageUrl, index) => ({
      key: `page-${String(index + 2)}`,
      kind: 'story' as const,
      imageUrl,
      text: null,
      number: index + 2,
    })),
    { key: 'end', kind: 'end', imageUrl: null, text: null },
  ];
  return (
    <BookViewer
      title={title}
      pages={pages}
      imageAlt={() => title}
      lockedLabel={t('exampleLocked')}
      badge={t('exampleTitle')}
    />
  );
}
