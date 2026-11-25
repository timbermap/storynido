/**
 * Arreglos deterministas del plan antes de escribir (libro de Angélica, 25 nov 2026): el plan
 * describía un abrazo que el pedido no pidió y dejaba «Texto: ''» en una página que lleva texto.
 */

/** Escena con un abrazo que el pedido no pidió: se cuenta un momento juntos, sin tocarse. */
const HUG_PATTERN =
  /\b(hug|hugs|hugging|hugged|embrac\w*|cuddl\w*|wrapping [^,;.]* arms|in (his|her|their) arms)\b|abraz\w*|abrac\w*/i;

export function withoutUnaskedHug<T extends { sceneGoal: string; mustBeVisible: string[] }>(
  scene: T,
  allowed: boolean,
): T {
  if (allowed) return scene;
  const touched =
    HUG_PATTERN.test(scene.sceneGoal) || scene.mustBeVisible.some((item) => HUG_PATTERN.test(item));
  if (!touched) return scene;
  return {
    ...scene,
    sceneGoal: `${scene.sceneGoal} (sin abrazo ni contacto: van juntos, uno al lado del otro, y se sonríen)`,
    mustBeVisible: scene.mustBeVisible.map((item) =>
      HUG_PATTERN.test(item)
        ? 'the protagonist and the adult standing side by side at a small distance, smiling at each other, not touching'
        : item,
    ),
  };
}

/** «Texto: ''» en una escena que lleva texto: se saca para que el redactor escriba la página. */
export function withTextGoal(sceneGoal: string): string {
  const empty = /Texto:\s*(?:''|""|«»|“”)\s*\|?\s*/i;
  return empty.test(sceneGoal)
    ? `${sceneGoal.replace(empty, '').trim()} (esta página lleva texto)`
    : sceneGoal;
}
