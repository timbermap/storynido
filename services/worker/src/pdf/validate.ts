import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

import { MM_PER_INCH, PT_PER_MM } from './spec';

export interface PdfCheck {
  ok: boolean;
  errors: string[];
  pageCount: number;
}

/**
 * Validaciones bloqueantes de un PDF: cantidad de páginas, tamaño de cada página (con
 * sangrado), área de corte en imprenta y tipografías embebidas.
 */
export async function validatePdf(
  bytes: Uint8Array,
  expected: { pages: number; widthMm: number; heightMm: number; bleedMm: number },
): Promise<PdfCheck> {
  const doc = await PDFDocument.load(bytes);
  const errors: string[] = [];
  const pageCount = doc.getPageCount();
  if (pageCount !== expected.pages) {
    errors.push(`páginas: ${String(pageCount)} en vez de ${String(expected.pages)}`);
  }
  doc.getPages().forEach((page, index) => {
    const { width, height } = page.getSize();
    const widthMm = width / PT_PER_MM;
    const heightMm = height / PT_PER_MM;
    if (
      Math.abs(widthMm - expected.widthMm) > 0.5 ||
      Math.abs(heightMm - expected.heightMm) > 0.5
    ) {
      errors.push(
        `página ${String(index + 1)}: ${widthMm.toFixed(1)}×${heightMm.toFixed(1)} mm en vez de ${String(expected.widthMm)}×${String(expected.heightMm)} mm`,
      );
    }
    if (expected.bleedMm > 0) {
      const trim = page.getTrimBox();
      const inset = trim.x / PT_PER_MM;
      if (Math.abs(inset - expected.bleedMm) > 0.2) {
        errors.push(
          `página ${String(index + 1)}: sangrado ${inset.toFixed(2)} mm en vez de ${String(expected.bleedMm)} mm`,
        );
      }
    }
  });
  // Cada tipografía tiene su archivo embebido (ninguna depende de las fuentes del visor).
  let fonts = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    if (object.get(PDFName.of('Type')) !== PDFName.of('FontDescriptor')) continue;
    fonts += 1;
    const embedded = ['FontFile', 'FontFile2', 'FontFile3'].some((key) =>
      object.has(PDFName.of(key)),
    );
    if (!embedded)
      errors.push(`tipografía sin embeber: ${String(object.get(PDFName.of('FontName')))}`);
  }
  if (fonts === 0) errors.push('el PDF no tiene tipografías embebidas');
  return { ok: errors.length === 0, errors, pageCount };
}

/** Resolución efectiva de una ilustración a página completa (con sangrado). */
export function effectiveDpi(imageWidthPx: number, pageWidthMm: number): number {
  return imageWidthPx / (pageWidthMm / MM_PER_INCH);
}
