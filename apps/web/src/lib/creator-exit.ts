'use client';

/**
 * Lo que comparten el creador (abajo) y el botón de salir del encabezado (arriba): si el borrador
 * ya tiene algo que valga la pena preguntar antes de salir, y una forma de abrir el diálogo de
 * salida desde el botón «atrás» del navegador.
 */

const STEP_DRAFT_PREFIX = 'storynido:draft:';
// Campos de texto del primer paso (el protagonista): la edad y los pronombres traen valores por
// defecto y no cuentan como «escribió algo».
const CHILD_TEXT_FIELDS = ['name', 'alias', 'like', 'likes', 'petName', 'friend', 'dedication'];

/** Por borrador: si ya pasó del primer paso o tiene protagonista o fotos (lo publica el creador). */
const started = new Map<string, boolean>();

export function setCreatorDraftStarted(bookId: string, value: boolean): void {
  started.set(bookId, value);
}

function filled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

/** Lo que se está escribiendo en el primer paso (guardado en este dispositivo, sin «Siguiente»). */
function childStepHasText(bookId: string): boolean {
  try {
    const raw = window.localStorage.getItem(`${STEP_DRAFT_PREFIX}${bookId}:child`);
    if (!raw) return false;
    const values = (JSON.parse(raw) as { values?: Record<string, unknown> }).values ?? {};
    return CHILD_TEXT_FIELDS.some((field) => filled(values[field]));
  } catch {
    return false;
  }
}

/**
 * Borrador sin nada que perder: no pasó del primer paso, sin protagonista ni fotos y sin texto
 * escrito. Si el creador todavía no cargó, no se sabe: se trata como con contenido (se pregunta).
 */
export function isCreatorDraftEmpty(bookId: string): boolean {
  const known = started.get(bookId);
  if (known !== false) return false;
  return !childStepHasText(bookId);
}

type ExitRequest = () => void;
let exitRequest: ExitRequest | null = null;

/** El botón de salir del encabezado se registra para que el «atrás» del navegador lo use. */
export function registerCreatorExit(handler: ExitRequest): () => void {
  exitRequest = handler;
  return () => {
    if (exitRequest === handler) exitRequest = null;
  };
}

/** Pide salir como si se tocara la X; `false` si no hay botón de salida (borrador sin guardar). */
export function requestCreatorExit(): boolean {
  if (!exitRequest) return false;
  exitRequest();
  return true;
}
