import { z } from 'zod';

/** Códigos de control de calidad registrados por libro (sin datos del niño). */
export const QA_CODES = [
  'name_mismatch',
  'length_out_of_range',
  'moderation_text',
  'moderation_image',
  'character_approved',
  'character_corrected',
] as const;

export const qaEventSchema = z.object({
  code: z.enum(QA_CODES),
  at: z.date(),
  /** Detalle técnico sin datos personales (por ejemplo, cantidad de páginas afectadas). */
  detail: z.record(z.string(), z.union([z.number(), z.boolean(), z.string().max(80)])).nullable(),
});

export type QaEvent = z.infer<typeof qaEventSchema>;

const strip = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j] ?? 0;
      row[j] = Math.min(
        (row[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

export interface NameIssue {
  name: string;
  problem: 'missing' | 'misspelled';
  /** Forma encontrada (por ejemplo "Mia" en lugar de "Mía"). */
  found?: string;
}

/**
 * Nombres que tienen que aparecer tal cual (con tildes y mayúsculas): el del protagonista y,
 * si hay, el apodo. Detecta ausencias y variantes mal escritas: diferencias de tildes ("Mia" por
 * "Mía") o una letra cambiada con el mismo largo ("Martona"). Una palabra más larga o más corta
 * ("Martín" frente a "Martina") puede ser otro personaje y no se marca.
 */
export function nameIssues(texts: readonly string[], names: readonly string[]): NameIssue[] {
  const words: string[] = texts.join(' ').match(/[\p{L}\p{M}'’-]+/gu) ?? [];
  const issues: NameIssue[] = [];
  for (const name of names.filter((item) => item.trim().length > 0)) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ?? name;
    if (!words.includes(first)) {
      issues.push({ name, problem: 'missing' });
      continue;
    }
    const wrong = words.find(
      (word) =>
        word !== first &&
        word.toLowerCase() !== first.toLowerCase() &&
        first.length >= 3 &&
        (strip(word) === strip(first) ||
          (first.length >= 5 &&
            word.length === first.length &&
            distance(strip(word), strip(first)) === 1 &&
            word[0]?.toUpperCase() === word[0])),
    );
    if (wrong) issues.push({ name, problem: 'misspelled', found: wrong });
  }
  return issues;
}
