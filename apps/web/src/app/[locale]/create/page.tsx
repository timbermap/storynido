import { getTranslations } from 'next-intl/server';

import { parseChannel } from '@storynido/shared';

import { CreateStart } from '@/components/wizard/create-start';

interface Props {
  searchParams: Promise<{ story?: string; lesson?: string; line?: string }>;
}

const slug = (value: string | undefined) =>
  value && /^[a-z0-9-]{1,80}$/.test(value) ? value : null;

export default async function CreatePage({ searchParams }: Props) {
  const { story, lesson, line } = await searchParams;
  const t = await getTranslations('Landing.professionals');
  return (
    <CreateStart
      storyId={slug(story)}
      lessonId={slug(lesson)}
      channel={parseChannel(line)}
      proGate={{ title: t('signInTitle'), text: t('signInText') }}
    />
  );
}
