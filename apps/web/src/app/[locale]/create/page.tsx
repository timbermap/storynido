import { getTranslations } from 'next-intl/server';

import { parseChannel, type Locale } from '@storynido/shared';

import { CreateStart } from '@/components/wizard/create-start';
import { loadWizardCatalog } from '@/lib/server/wizard-catalog';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ story?: string; lesson?: string; line?: string }>;
}

const slug = (value: string | undefined) =>
  value && /^[a-z0-9-]{1,80}$/.test(value) ? value : null;

export default async function CreatePage({ params, searchParams }: Props) {
  const { story, lesson, line } = await searchParams;
  const locale = (await params).locale as Locale;
  // El creador arranca acá mismo (borrador en memoria): necesita el catálogo.
  const [t, catalog] = await Promise.all([
    getTranslations('Landing.professionals'),
    loadWizardCatalog(locale),
  ]);
  return (
    <CreateStart
      storyId={slug(story)}
      lessonId={slug(lesson)}
      channel={parseChannel(line)}
      proGate={{ title: t('signInTitle'), text: t('signInText') }}
      catalog={catalog}
    />
  );
}
