/**
 * Nombres frecuentes que casi siempre llevan tilde: si alguien escribe «Angelica», se le sugiere
 * «Angélica». Solo sugiere, nunca corrige solo: algunas familias lo escriben sin tilde a propósito.
 */
const ACCENTED = [
  'Adrián', 'Agustín', 'Álvaro', 'Andrés', 'Ángel', 'Ángela', 'Angélica', 'Aníbal', 'Bárbara',
  'Bastián', 'César', 'Damián', 'Efraín', 'Elías', 'Fabián', 'Félix', 'Germán', 'Héctor', 'Hernán',
  'Inés', 'Iván', 'Jesús', 'Joaquín', 'José', 'Julián', 'Lucía', 'María', 'Martín', 'Matías',
  'Mónica', 'Nicolás', 'Óscar', 'Ramón', 'Raúl', 'Rocío', 'Rubén', 'Sebastián', 'Simón', 'Sofía',
  'Tomás', 'Úrsula', 'Valentín', 'Verónica', 'Zoé',
];

const strip = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase();

const BY_PLAIN = new Map(ACCENTED.map((name) => [strip(name), name]));

/** La versión con tilde de un nombre escrito sin ella, o null si no hay nada que sugerir. */
export function suggestAccent(typed: string): string | null {
  const value = typed.trim();
  // Con alguna letra acentuada, la persona ya decidió cómo se escribe.
  if (!value || /[À-ſ]/.test(value)) return null;
  return BY_PLAIN.get(strip(value)) ?? null;
}
