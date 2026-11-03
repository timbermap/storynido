import type { PublicCollection, PublicStory } from '@storynido/shared';

/**
 * El alias es también el nombre del cuento. Un proyecto anterior que los tenía separados conserva
 * su nombre mientras no se cambie el alias.
 */
export function storyNameFor(
  alias: string,
  child: { name: string; alias?: string | null } | null | undefined,
): string {
  const value = alias.trim();
  return child?.alias?.trim() === value ? child.name : value;
}

/** La colección de un borrador que ya trae historia: la del objetivo, o la primera de la historia. */
export function collectionOfDraft(
  collections: readonly PublicCollection[],
  story: PublicStory | undefined,
  goal: string | null | undefined,
): PublicCollection | null {
  if (!story) return null;
  const own = collections.filter((item) => story.collectionIds.includes(item.slug));
  return own.find((item) => goal && item.topics.includes(goal)) ?? own[0] ?? null;
}

/** Los cuentos base de una colección, primero los que le quedan bien a su edad. */
export function baseStories(
  stories: readonly PublicStory[],
  collectionSlug: string,
  age: number | undefined,
): PublicStory[] {
  const fits = (story: PublicStory) =>
    age !== undefined && story.ageMin <= age && age <= story.ageMax;
  return stories
    .filter(
      (story) =>
        story.channels.includes('professionals') && story.collectionIds.includes(collectionSlug),
    )
    .toSorted((a, b) => Number(fits(b)) - Number(fits(a)));
}
