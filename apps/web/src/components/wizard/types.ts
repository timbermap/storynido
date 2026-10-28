import type {
  Book,
  ContentType,
  EditorialConfig,
  PublicCollection,
  PublicLesson,
  PublicStory,
} from '@storynido/shared';

import type { ChildFields } from '@/lib/firebase/drafts';

import type { SaveState, WizardStep } from './steps';

export interface StepNav {
  stepIndex: number;
  /** Pasos ocultos para la línea comercial del libro. */
  hidden: readonly WizardStep[];
  maxReached: number;
  saveState: SaveState;
  onBack?: () => void;
  onJump: (index: number) => void;
  /** Avanza al paso siguiente (y lo registra como alcanzado). */
  goNext: () => Promise<void>;
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
}
