import { getTranslations } from 'next-intl/server';

import type { LineCopy } from './parts';

/** Nombre y frase de cada línea para la home con sesión: los mismos de «¿Para quién es?». */
export async function homeLineCopy(): Promise<LineCopy> {
  const t = await getTranslations('Home.audience');
  return {
    families: { chip: t('families.title'), text: t('families.text') },
    events: { chip: t('events.title'), text: t('events.text') },
    professionals: { chip: t('professionals.title'), text: t('professionals.text') },
  };
}
