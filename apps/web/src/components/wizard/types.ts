import type {
  Book,
  Channel,
  ContentType,
  CountryCode,
  EditorialConfig,
  Offer,
  PublicCollection,
  PublicLesson,
  PublicStory,
} from '@storynido/shared';

import type { ChildFields } from '@/lib/firebase/drafts';

import type { SaveState, WizardStep } from './steps';

export interface StepNav {
  /** Paso actual. */
  step: WizardStep;
  /** Pasos de la línea del libro, en orden (FLOWS). */
  flow: readonly WizardStep[];
  /** Posición más lejana alcanzada en `flow`. */
  reached: number;
  /** Línea del libro: el creador la muestra arriba (Familia, Celebración, Profesional). */
  line: Channel;
  /** Borrador todavía sin guardar: la línea se puede cambiar (vuelve a /nuevo). */
  fresh?: boolean;
  saveState: SaveState;
  onBack?: () => void;
  /** Ir a un paso ya alcanzado. */
  onJump: (step: WizardStep) => void;
  /** Avanza al paso siguiente (y lo registra como alcanzado). */
  goNext: () => Promise<void>;
  /** Id del borrador; si está en memoria, lo crea (primer guardado real). */
  ensureBook: () => Promise<string>;
  /** Envuelve un guardado mostrando "Guardando…" / "Guardado" / error. */
  save: (action: () => Promise<void>) => Promise<boolean>;
}

export interface StyleOption {
  slug: string;
  name: string;
  sampleImage: string | null;
  contentTypes: ContentType[];
}

export interface WizardData {
  book: Book & { id: string };
  child: ChildFields | null;
  stories: PublicStory[];
  lessons: PublicLesson[];
  styles: StyleOption[];
  editorial: EditorialConfig;
  /** Colecciones de Profesionales: sus temas son los objetivos que se pueden elegir. */
  collections: PublicCollection[];
  /** Precios del país (los mismos de la ficha y el checkout); null si no se vende ahí. */
  prices: PriceHint | null;
}

/** Digital y el impreso más barato, en la moneda del país. */
export interface PriceHint {
  currency: Offer['currency'];
  country: CountryCode;
  digitalMinor: number | null;
  printedFromMinor: number | null;
}
