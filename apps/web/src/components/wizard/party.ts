import {
  KIT_PIECES,
  type EventType,
  recommendedStyle,
  suggestedReading,
  type Book,
  type EventPricing,
  type KitOffer,
  type KitPiece,
  type PublicCollection,
  type PublicStory,
} from '@storynido/shared';

import type { StyleOption } from './types';

const normalize = (value: string) => value.trim().toLocaleLowerCase();

/** La temática que llega de la landing (`?tema=`) o de un borrador: por nombre o por slug. */
export function matchTheme(
  themes: readonly PublicCollection[],
  theme: string | null | undefined,
): PublicCollection | null {
  if (!theme) return null;
  const wanted = normalize(theme);
  return (
    themes.find((item) => normalize(item.name) === wanted || normalize(item.slug) === wanted) ??
    null
  );
}

/**
 * La temática y la ocasión con que arranca un kit. Lo que viene en la URL manda; si solo viene la
 * historia (el «Crear» de la ficha), salen de su colección: la historia de la primera comunión
 * arranca como primera comunión, con su temática elegida.
 */
export function eventPresetFor(
  themes: readonly PublicCollection[],
  stories: readonly PublicStory[],
  storyId: string | null,
  theme: string | null,
  type: EventType | null,
): { theme: string | null; type: EventType | null } {
  const story = storyId ? stories.find((item) => item.slug === storyId) : undefined;
  const own = story ? themes.filter((item) => story.collectionIds.includes(item.slug)) : [];
  const collection = own.find((item) => item.eventType) ?? own[0];
  return {
    theme: theme ?? collection?.name ?? null,
    type: type ?? collection?.eventType ?? null,
  };
}

/**
 * La historia del cuento de recuerdo: la temática ya dice de qué va, así que no se pregunta. Se
 * conserva la que ya estaba si es de esa temática; si no, la primera que le queda bien a su edad.
 */
export function storyForTheme(
  stories: readonly PublicStory[],
  themeSlug: string,
  age: number | undefined,
  currentId: string | null,
): PublicStory | null {
  const events = stories.filter((story) => story.channels.includes('events'));
  const inTheme = events.filter((story) => story.collectionIds.includes(themeSlug));
  const options = inTheme.length > 0 ? inTheme : events;
  const fits = (story: PublicStory) =>
    age !== undefined && story.ageMin <= age && age <= story.ageMax;
  return (
    options.find((story) => story.slug === currentId) ?? options.find(fits) ?? options[0] ?? null
  );
}

/** El estilo del kit: el recomendado de la historia, si se ofrece para su tipo de contenido. */
export function styleForStory(
  story: PublicStory,
  styles: readonly StyleOption[],
  contentType: Book['contentType'],
): string | null {
  const wanted = story.defaultStyle ?? recommendedStyle(story);
  const usable = styles.filter((style) => style.contentTypes.includes(contentType));
  return usable.find((style) => style.slug === wanted)?.slug ?? usable[0]?.slug ?? null;
}

/** Opciones editoriales iniciales de Celebraciones y Profesionales: mini, con la lectura según la edad. */
export function miniBookOptions(age: number | undefined) {
  return {
    ...(age === undefined ? {} : suggestedReading(age)),
    length: 'mini' as const,
  };
}

/** Las piezas que se marcan en el pago según lo que eligió en el creador. */
export function piecesForOffer(offer: KitOffer, sold: readonly string[]): KitPiece[] {
  const pieces: KitPiece[] = offer === 'invitation' ? ['invitation'] : [...KIT_PIECES];
  return ['mini_book', ...pieces.filter((piece) => piece !== 'mini_book' && sold.includes(piece))];
}

/** Lo que cuesta cada opción, con la misma cuenta que la landing y el pago. */
export function offerPrices(
  pricing: Pick<EventPricing, 'designMinor' | 'pieces' | 'bundlePercent'>,
) {
  const pieces = Object.values(pricing.pieces);
  const full = pricing.designMinor + pieces.reduce((sum, value) => sum + value, 0);
  return {
    invitationMinor: pricing.designMinor + (pricing.pieces.invitation ?? 0),
    fullKitMinor: full - Math.round((full * (pricing.bundlePercent ?? 0)) / 100),
  };
}
