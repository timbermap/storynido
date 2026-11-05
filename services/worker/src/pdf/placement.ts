import sharp from 'sharp';

/** Dónde va el panel de texto sobre la ilustración. */
export const TEXT_PLACEMENTS = [
  'bottom',
  'top',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;

export type TextPlacement = (typeof TEXT_PLACEMENTS)[number];

/** Región de cada ubicación, en fracciones de la imagen: [x, y, ancho, alto]. */
const REGIONS: Record<TextPlacement, [number, number, number, number]> = {
  bottom: [0, 0.62, 1, 0.38],
  top: [0, 0, 1, 0.38],
  'top-left': [0, 0, 0.62, 0.45],
  'top-right': [0.38, 0, 0.62, 0.45],
  'bottom-left': [0, 0.55, 0.62, 0.45],
  'bottom-right': [0.38, 0.55, 0.62, 0.45],
};

const W = 48;
const H = 64;

/** Detalle visual de una región: bordes (gradiente medio) más contraste (desvío). */
function busyness(pixels: Uint8Array, region: [number, number, number, number]): number {
  const [rx, ry, rw, rh] = region;
  const x0 = Math.floor(rx * W);
  const y0 = Math.floor(ry * H);
  const x1 = Math.min(W - 1, Math.floor((rx + rw) * W));
  const y1 = Math.min(H - 1, Math.floor((ry + rh) * H));
  let edges = 0;
  let sum = 0;
  let squares = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const value = pixels[y * W + x] ?? 0;
      edges +=
        Math.abs(value - (pixels[y * W + x + 1] ?? value)) +
        Math.abs(value - (pixels[(y + 1) * W + x] ?? value));
      sum += value;
      squares += value * value;
      count += 1;
    }
  }
  if (count === 0) return Number.POSITIVE_INFINITY;
  const mean = sum / count;
  return edges / count + Math.sqrt(Math.max(0, squares / count - mean * mean)) / 2;
}

/** Cara detectada en la ilustración, en fracciones de la imagen (0 a 1). */
export interface FaceRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Mitad de la página que el prompt pidió dejar calma para el texto (pageScene). */
export type CalmSide = 'top' | 'bottom';

export interface PlacementPage {
  image: Uint8Array;
  words: number;
  /** Lado que se le pidió al modelo dejar libre: se prefiere salvo que esté mucho más cargado. */
  calmSide?: CalmSide | null;
  /** Caras detectadas: una región que tape una cara queda descartada. */
  faces?: readonly FaceRegion[];
}

const sideOf = (placement: TextPlacement): CalmSide =>
  placement.startsWith('top') ? 'top' : 'bottom';

/** Fracción de la cara que queda debajo de la región. */
function faceOverlap(region: [number, number, number, number], face: FaceRegion): number {
  const [rx, ry, rw, rh] = region;
  const width = Math.min(rx + rw, face.left + face.width) - Math.max(rx, face.left);
  const height = Math.min(ry + rh, face.top + face.height) - Math.max(ry, face.top);
  const area = face.width * face.height;
  return width <= 0 || height <= 0 || area <= 0 ? 0 : (width * height) / area;
}

/** Más de esta fracción de una cara bajo el panel: la región no sirve. */
const FACE_OVERLAP_LIMIT = 0.15;
/** Peso del lado pedido en el prompt (menor = más preferido). */
const CALM_SIDE_WEIGHT = 0.55;

/**
 * Ubicación del texto de cada página: la región más calma de su ilustración, sin tapar caras. Se
 * prefiere el lado que el prompt pidió dejar libre (arriba o abajo); las esquinas solo para textos
 * cortos; una pequeña penalidad evita repetir la misma ubicación en páginas seguidas. Si todas las
 * regiones tapan una cara, se elige igual entre todas (mejor un texto que ningún texto).
 */
export async function textPlacements(
  pages: readonly PlacementPage[],
  options: { allowCorners: boolean },
): Promise<TextPlacement[]> {
  const result: TextPlacement[] = [];
  for (const page of pages) {
    const pixels = new Uint8Array(
      await sharp(page.image).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer(),
    );
    const allowed = TEXT_PLACEMENTS.filter(
      (placement) =>
        placement === 'bottom' || placement === 'top' || (options.allowCorners && page.words <= 45),
    );
    const faces = page.faces ?? [];
    const clear = allowed.filter((placement) =>
      faces.every((face) => faceOverlap(REGIONS[placement], face) <= FACE_OVERLAP_LIMIT),
    );
    const candidates = clear.length > 0 ? clear : allowed;
    const previous = result.at(-1);
    const scored = candidates.map((placement) => {
      const weight = page.calmSide
        ? sideOf(placement) === page.calmSide
          ? CALM_SIDE_WEIGHT
          : 1
        : placement === 'bottom'
          ? 0.97
          : 1;
      const base = busyness(pixels, REGIONS[placement]) * weight;
      // Repetir la ubicación anterior suma (también en fondos lisos, donde todo da 0).
      const repeat = placement === previous ? 1.5 + base * 0.12 : 0;
      // En fondos lisos (todo da 0), el lado pedido gana igual.
      const side = page.calmSide && sideOf(placement) !== page.calmSide ? 2 : 0;
      return { placement, score: base + repeat + side };
    });
    scored.sort((a, b) => a.score - b.score);
    result.push(scored[0]?.placement ?? 'bottom');
  }
  return result;
}
