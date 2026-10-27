import { createHash } from 'node:crypto';

interface ApprovedPreview {
  title: string;
  pages: readonly { text: string; imagePath?: string | null }[];
  cover?: { imagePath: string } | null;
  character?: {
    imagePath: string;
    traits: unknown;
    mustKeep: unknown;
    approvedAt?: unknown;
  } | null;
}

/**
 * Huella de lo que el comprador vio y aprobó: textos, ilustraciones, lámina y rasgos. Se guarda
 * al pagar; si después cambia algo (foto, nombre, texto), el pedido no avanza sin una nueva
 * aprobación ("lo que aprobás es lo que recibís").
 */
export function previewFingerprint(preview: ApprovedPreview): string {
  const content = {
    title: preview.title,
    pages: preview.pages.map((page) => [page.text, page.imagePath ?? null]),
    cover: preview.cover?.imagePath ?? null,
    character: preview.character
      ? [preview.character.imagePath, preview.character.traits, preview.character.mustKeep]
      : null,
  };
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
