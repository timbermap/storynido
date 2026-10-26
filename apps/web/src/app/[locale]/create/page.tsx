import { CreateStart } from '@/components/wizard/create-start';

interface Props {
  searchParams: Promise<{ story?: string; lesson?: string }>;
}

const slug = (value: string | undefined) =>
  value && /^[a-z0-9-]{1,80}$/.test(value) ? value : null;

export default async function CreatePage({ searchParams }: Props) {
  const { story, lesson } = await searchParams;
  return <CreateStart storyId={slug(story)} lessonId={slug(lesson)} />;
}
