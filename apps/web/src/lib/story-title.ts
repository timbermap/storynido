import { castNameFor, type Locale } from '@storynido/shared';

/**
 * El título de una historia con el nombre del chico en lugar del de su personaje de ejemplo
 * («Benja y el valle de los dinosaurios» → «Toto y el valle de los dinosaurios»). Sin nombre o sin
 * personaje de ejemplo en el título, queda igual. Es solo para mostrar: la portada ilustrada sigue
 * con el elenco (un nombre escrito podría no corresponder al dibujo).
 */
export function titleForChild(
  story: { title: string; castName?: string | undefined },
  childName: string | null | undefined,
  locale: Locale,
): string {
  const name = childName?.trim();
  if (!name || !story.castName) return story.title;
  const cast = castNameFor(story.castName, locale);
  return story.title.includes(cast) ? story.title.replaceAll(cast, name) : story.title;
}
