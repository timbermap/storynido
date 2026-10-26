import type { Book, PublicLesson, PublicStory } from '@storynido/shared';

import type { ChildFields } from '@/lib/firebase/drafts';

import type { SaveState } from './steps';

export interface StepNav {
  stepIndex: number;
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
}

export interface WizardData {
  book: Book & { id: string };
  child: ChildFields | null;
  stories: PublicStory[];
  lessons: PublicLesson[];
  styles: StyleOption[];
}
