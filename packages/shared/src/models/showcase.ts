/**
 * Libros de ejemplo aprobados por la mesa (DECISIONS 348, 26 nov 2026, Sebas: «los cuentos que
 * pasan la mesa, convendría ponerlos en algún lugar de ejemplo?»).
 *
 * - Solo libros del golden set (eval:pedidos): chicos inventados, nunca fotos ni datos reales y
 *   nunca el libro de Angelica (DECISIONS 253).
 * - Califica con nota de la mesa 4 o más, el comprador lo compraría y sin fallas duras del
 *   contrato del pedido. Se muestra tal cual salió, sin retoques.
 * - Sebas aprueba cada libro en el admin antes de publicarlo.
 * - La sección («Así queda un libro real») queda oculta hasta tener SHOWCASE_MIN_BOOKS aprobados
 *   en ese idioma.
 */
import { z } from 'zod';

import { localeSchema } from '../i18n';
import { channelSchema } from './channels';

/** Libros aprobados que hacen falta para abrir la sección en un idioma. */
export const SHOWCASE_MIN_BOOKS = 3;
/** Nota mínima de la mesa (la del juez más bajo, de 1 a 5). */
export const SHOWCASE_MIN_SCORE = 4;

export const SHOWCASE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const showcaseStatusSchema = z.enum(SHOWCASE_STATUSES);
export type ShowcaseStatus = z.infer<typeof showcaseStatusSchema>;

/** Nombre de un archivo del libro en Storage (assets/showcase/{id}/…). */
export const SHOWCASE_FILE_PATTERN = /^(tapa|pagina-\d{1,2})\.webp$/;
export const showcaseFilePath = (id: string, file: string) => `showcase/${id}/${file}`;

export const showcasePanelSchema = z.object({
  /** Nota de la mesa: la del juez más bajo. */
  score: z.number().nullable(),
  weakest: z.string().nullable(),
  /** Veredicto del comprador. */
  verdict: z.enum(['compra', 'duda', 'no']).nullable(),
  buy: z.number().nullable(),
  /** Nota de cada juez (comprador, continuidad, chico, profesional). */
  judges: z.record(z.string(), z.number()),
  /** Lo que le encantó al comprador. */
  loved: z.array(z.string()),
});
export type ShowcasePanel = z.infer<typeof showcasePanelSchema>;

/** showcaseBooks/{id}: un libro del golden set candidato a ejemplo público (solo servidor). */
export const showcaseBookSchema = z.object({
  storySlug: z.string(),
  channel: channelSchema,
  locale: localeSchema,
  title: z.string(),
  /** Nombre inventado del protagonista (va grande en la tapa). */
  childName: z.string(),
  age: z.number().int(),
  styleSlug: z.string(),
  /** Archivos en Storage: la tapa y las páginas armadas, como las ve el cliente. */
  cover: z.string(),
  pages: z.array(z.object({ file: z.string(), text: z.string() })),
  panel: showcasePanelSchema,
  /** De qué corrida del golden set salió. */
  source: z.object({
    report: z.string(),
    caseId: z.string(),
    run: z.number().int(),
    arm: z.string().nullable(),
  }),
  /** Cumple las reglas para publicarse; si no, por qué (el admin no deja aprobarlo). */
  eligible: z.boolean(),
  reasons: z.array(z.string()),
  status: showcaseStatusSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type ShowcaseBook = z.infer<typeof showcaseBookSchema>;

/** Lo mínimo de una fila de resultados.json de eval:pedidos para decidir si califica. */
export interface ShowcaseCandidate {
  caseId: string;
  /** Ids del golden set (pedidos-cases.ts): solo esos libros pueden mostrarse. */
  goldenIds: readonly string[];
  title: string;
  pages: readonly string[];
  clauses: Readonly<Record<string, string | undefined>>;
  error?: string;
  panel?: {
    score: number | null;
    errors: readonly string[];
    buyer?: { verdict: string } | undefined;
  } | null;
}

/** Nombres que nunca se publican (DECISIONS 253: el libro de una nena real). */
const NEVER_SHOWN = /ang[eé]lica/i;

/** Por qué un libro no puede ser ejemplo público; vacío si califica. */
export function showcaseReasons(row: ShowcaseCandidate): string[] {
  const reasons: string[] = [];
  if (!row.goldenIds.includes(row.caseId)) reasons.push('no es del golden set');
  if (row.error) reasons.push(`la corrida falló: ${row.error.slice(0, 80)}`);
  if ([row.title, ...row.pages].some((text) => NEVER_SHOWN.test(text))) {
    reasons.push('nombra a una persona real (DECISIONS 253)');
  }
  const panel = row.panel;
  if (!panel) {
    reasons.push('no pasó por la mesa de jueces');
  } else {
    if (panel.errors.length > 0) reasons.push('la mesa no terminó (un juez falló)');
    if (panel.score === null || panel.score < SHOWCASE_MIN_SCORE) {
      reasons.push(
        `nota de la mesa ${panel.score === null ? '-' : String(panel.score)} (mínimo ${String(SHOWCASE_MIN_SCORE)})`,
      );
    }
    if (panel.buyer?.verdict !== 'compra') {
      reasons.push(`el comprador no lo compraría (${panel.buyer?.verdict ?? 'sin veredicto'})`);
    }
  }
  const failed = Object.entries(row.clauses)
    .filter(([, verdict]) => verdict === 'fail')
    .map(([clause]) => clause);
  if (failed.length > 0) reasons.push(`fallas duras: ${failed.join(', ')}`);
  return reasons;
}
