import type { BookFormat } from '@storynido/shared';

/** Libro de 21×28 cm vertical: la misma proporción 3:4 de las ilustraciones (DECISIONS 069). */
export const TRIM_MM = { width: 210, height: 280 } as const;

export interface FormatSpec {
  format: BookFormat;
  /** Sangrado por lado (0 en digital). */
  bleedMm: number;
  /** Margen interno donde nunca va texto. */
  safeMm: number;
  /** Resolución efectiva mínima de cada ilustración. */
  minDpi: number;
  /** Calidad JPEG de las ilustraciones embebidas. */
  jpegQuality: number;
  /** Ancho máximo de las ilustraciones (px): el digital se aliviana. */
  maxImagePx: number;
  /** Reglas de la imprenta: fuera de rango, el libro queda solo digital. */
  pages: { min: number; max: number; multipleOf: number } | null;
}

/**
 * Especificaciones por formato. Las de imprenta son provisorias hasta confirmar con Gelato el
 * producto y el SKU de cada país (fase 12): sangrado, páginas y lomo.
 */
export const FORMAT_SPECS: Record<BookFormat, FormatSpec> = {
  digital: {
    format: 'digital',
    bleedMm: 0,
    safeMm: 12,
    // En pantalla alcanza con menos: una ilustración de 768 px se ve bien en un celular o tablet.
    minDpi: 72,
    jpegQuality: 82,
    maxImagePx: 1600,
    pages: null,
  },
  softcover: {
    format: 'softcover',
    bleedMm: 3,
    safeMm: 12,
    minDpi: 200,
    jpegQuality: 92,
    maxImagePx: 4000,
    pages: { min: 12, max: 120, multipleOf: 2 },
  },
  hardcover: {
    format: 'hardcover',
    bleedMm: 3,
    safeMm: 12,
    minDpi: 200,
    jpegQuality: 92,
    maxImagePx: 4000,
    pages: { min: 20, max: 120, multipleOf: 2 },
  },
};

/** Tamaño de página con sangrado. */
export function pageSizeMm(spec: FormatSpec) {
  return {
    width: TRIM_MM.width + 2 * spec.bleedMm,
    height: TRIM_MM.height + 2 * spec.bleedMm,
  };
}

/** Lomo aproximado (papel ~130 g): provisorio hasta tener el cálculo de Gelato por SKU. */
export function spineMm(interiorPages: number, format: BookFormat): number {
  if (format === 'digital') return 0;
  const base = format === 'hardcover' ? 4 : 1;
  return Math.max(base + interiorPages * 0.1, format === 'hardcover' ? 6 : 3);
}

/** Si la cantidad de páginas no cumple con la imprenta, el libro queda solo digital. */
export function printablePages(spec: FormatSpec, pages: number): boolean {
  if (!spec.pages) return true;
  return pages >= spec.pages.min && pages <= spec.pages.max && pages % spec.pages.multipleOf === 0;
}

export const MM_PER_INCH = 25.4;
export const PT_PER_MM = 72 / MM_PER_INCH;
