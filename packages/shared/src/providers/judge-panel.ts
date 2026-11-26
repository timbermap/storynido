/**
 * Mesa de jueces (26 nov 2026, Sebas: «esto sería mesa juez? con todos?»). Cada libro pasa por:
 *
 * 1. Comprador: tapa y páginas armadas; si lo compraría, si lo regalaría, si la muestra gratis lo
 *    habría hecho pagar (ventas) y qué página compartiría (marketing).
 * 2. Continuidad: las ilustraciones juntas contra las láminas; lo que cambia de página a página.
 * 3. El chico que escucha: solo el texto, leído en voz alta a un chico de esa edad.
 * 4. Profesional: solo en la línea Profesionales; si cumple el objetivo sin riesgos.
 *
 * La nota de la mesa es la del juez más bajo (un solo problema grave alcanza para que el padre no
 * vuelva) y los arreglos salen primero de los jueces que pusieron menos, con la parte del proceso
 * que los tiene que hacer. Corre al armar cada libro (worker), en el golden set y sobre los pedidos
 * terminados; el resultado queda en el pedido (admin). Desde DECISIONS 352 también puede frenar la
 * entrega (`judgeGate`).
 */
import { z } from 'zod';

import type {
  AITextProvider,
  AiUsage,
  BuyerReview,
  ChildListenerReview,
  ContinuityReview,
  ImageData,
  JudgeFix,
  ProfessionalReview,
} from './ai';

export type PanelChannel = 'families' | 'professionals' | 'events';

export interface PanelInput {
  channel: PanelChannel;
  priceUsd: number;
  /** El pedido en palabras, sin datos de un chico real. */
  order: string;
  goal?: string | null;
  title: string;
  texts: string[];
  age: number;
  language: string;
  refrain?: string | null;
  /** El estilo elegido, en palabras. */
  style: string;
  cover: ImageData;
  /** Páginas armadas (dibujo con texto), como las ve el cliente. */
  composed: ImageData[];
  /** Las mismas ilustraciones sin texto, para la continuidad. */
  drawn: ImageData[];
  /** Lámina del protagonista; sin ella no corre la continuidad. */
  reference?: ImageData | null;
  companionReference?: ImageData | null;
  companion?: string | null;
}

type Strip<T> = Omit<T, 'usage'>;

export interface Panel {
  buyer?: Strip<BuyerReview>;
  continuity?: Strip<ContinuityReview>;
  child?: Strip<ChildListenerReview>;
  professional?: Strip<ProfessionalReview>;
  /** Nota de la mesa: la del juez más bajo (1 a 5). */
  score: number | null;
  weakest: string | null;
  fixes: (JudgeFix & { judge: string })[];
  errors: string[];
}

export const JUDGE_NAMES = {
  buyer: 'comprador',
  continuity: 'continuidad',
  child: 'chico',
  professional: 'profesional',
} as const;

type JudgeKey = keyof typeof JUDGE_NAMES;

/** La nota de cada juez, en la misma escala de 1 a 5. */
const scoreOf = (panel: Panel, judge: JudgeKey): number | null => {
  if (judge === 'buyer') return panel.buyer?.buy ?? null;
  return panel[judge]?.score ?? null;
};

/** ¿El proveedor de texto tiene la mesa? (la IA simulada no). */
export const hasJudgePanel = (text: AITextProvider): boolean =>
  typeof text.reviewAsBuyer === 'function' && typeof text.reviewAsChildListener === 'function';

export async function runPanel(
  text: AITextProvider,
  input: PanelInput,
  spend: (usage: AiUsage) => void | Promise<void>,
): Promise<Panel> {
  const tasks: Partial<Record<JudgeKey, Promise<{ usage: AiUsage } & object> | undefined>> = {
    buyer: text.reviewAsBuyer?.({
      channel: input.channel,
      priceUsd: input.priceUsd,
      order: input.order,
      title: input.title,
      texts: input.texts,
      cover: input.cover,
      pages: input.composed,
    }),
    child: text.reviewAsChildListener?.({
      age: input.age,
      language: input.language,
      title: input.title,
      texts: input.texts,
      refrain: input.refrain ?? null,
    }),
  };
  if (input.reference && input.drawn.length > 0) {
    tasks.continuity = text.reviewContinuity?.({
      reference: input.reference,
      companionReference: input.companionReference ?? null,
      companion: input.companion ?? null,
      style: input.style,
      cover: input.cover,
      pages: input.drawn,
      texts: input.texts,
    });
  }
  if (input.channel === 'professionals') {
    tasks.professional = text.reviewAsProfessional?.({
      age: input.age,
      order: input.order,
      goal: input.goal ?? null,
      title: input.title,
      texts: input.texts,
    });
  }
  const entries = (Object.keys(tasks) as JudgeKey[]).flatMap((key) => {
    const task = tasks[key];
    return task ? [{ key, task }] : [];
  });
  const keys = entries.map((entry) => entry.key);
  const settled = await Promise.allSettled(entries.map((entry) => entry.task));
  const panel: Panel = { score: null, weakest: null, fixes: [], errors: [] };
  for (const [index, result] of settled.entries()) {
    const key = keys[index];
    if (!key) continue;
    if (result.status === 'rejected') {
      panel.errors.push(`${JUDGE_NAMES[key]}: ${(result.reason as Error).message.slice(0, 120)}`);
      continue;
    }
    const value = result.value;
    const { usage, ...review } = value;
    await spend(usage);
    (panel as unknown as Record<string, unknown>)[key] = review;
  }
  const scored = keys
    .map((key) => ({ key, score: scoreOf(panel, key) }))
    .filter((item): item is { key: JudgeKey; score: number } => item.score !== null)
    .sort((a, b) => a.score - b.score);
  const lowest = scored[0];
  if (lowest) {
    panel.score = lowest.score;
    panel.weakest = JUDGE_NAMES[lowest.key];
  }
  // Los arreglos de los jueces que pusieron menos van primero; tres en total.
  for (const { key } of scored) {
    for (const fix of panel[key]?.fixes ?? []) {
      if (panel.fixes.length < 3) panel.fixes.push({ ...fix, judge: JUDGE_NAMES[key] });
    }
  }
  return panel;
}

const list = (items: string[]) => (items.length > 0 ? items.join('; ') : '-');

/** Una línea por libro para el informe. */
export function panelLines(label: string, panel: Panel): string[] {
  const lines = [
    `### ${label}: mesa ${panel.score === null ? '-' : String(panel.score)}/5${panel.weakest ? ` (la baja ${panel.weakest})` : ''}`,
  ];
  const { buyer, continuity, child, professional } = panel;
  if (buyer) {
    lines.push(
      `- **Comprador:** ${buyer.verdict} · compra ${String(buyer.buy)}/5 · regalo ${String(buyer.gift)}/5. Le encantó: ${list(buyer.loved)}. Reembolso: ${list(buyer.refund)}.`,
      `- **Ventas (muestra gratis):** ${String(buyer.sample)}/5. Lo frenaría: ${buyer.sampleObjection || '-'}.`,
      `- **Marketing (compartir):** ${String(buyer.share)}/5 · ${buyer.sharePage < 0 ? 'ninguna página' : buyer.sharePage === 0 ? 'la tapa' : `página ${String(buyer.sharePage)}`}: ${buyer.shareWhy || '-'}.`,
    );
  }
  if (continuity) {
    lines.push(
      `- **Continuidad:** ${String(continuity.score)}/5. ${list(continuity.issues.map((issue) => `p${String(issue.page)} ${issue.who}: ${issue.what}`))}.`,
    );
  }
  if (child) {
    lines.push(
      `- **El chico:** ${String(child.score)}/5 · entiende ${String(child.understood)}/5 · quiere más ${String(child.wantsMore)}/5. Difíciles: ${list(child.hardWords)}. Se pierde en: ${child.lostPages.length > 0 ? child.lostPages.join(', ') : '-'}. Lo que recordaría: ${child.favorite || '-'}.`,
    );
  }
  if (professional) {
    lines.push(
      `- **Profesional:** ${String(professional.score)}/5 · objetivo ${String(professional.meetsGoal)}/5 · ${professional.wouldUse ? 'lo usaría' : 'no lo usaría así'}. Riesgos: ${list(professional.risks)}.`,
    );
  }
  if (panel.fixes.length > 0) {
    lines.push(
      `- **Para un 5:** ${panel.fixes.map((fix) => `[${fix.area}, ${fix.judge}] ${fix.fix}`).join('; ')}`,
    );
  }
  if (panel.errors.length > 0) lines.push(`- Sin respuesta: ${panel.errors.join('; ')}`);
  return lines;
}

/** Promedios de la mesa y de cada juez sobre varios libros. */
export function panelSummary(panels: Panel[]): string {
  const avg = (values: (number | null | undefined)[]) => {
    const nums = values.filter((value): value is number => typeof value === 'number');
    return nums.length > 0
      ? (nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1)
      : '-';
  };
  const buys = panels.filter((panel) => panel.buyer?.verdict === 'compra').length;
  const areas = new Map<string, number>();
  for (const fix of panels.flatMap((panel) => panel.fixes)) {
    areas.set(fix.area, (areas.get(fix.area) ?? 0) + 1);
  }
  return [
    `Mesa ${avg(panels.map((panel) => panel.score))}/5 · lo compraría ${String(buys)}/${String(panels.length)}`,
    `comprador ${avg(panels.map((panel) => panel.buyer?.buy))} · regalo ${avg(panels.map((panel) => panel.buyer?.gift))} · muestra ${avg(panels.map((panel) => panel.buyer?.sample))} · compartir ${avg(panels.map((panel) => panel.buyer?.share))}`,
    `continuidad ${avg(panels.map((panel) => panel.continuity?.score))} · chico ${avg(panels.map((panel) => panel.child?.score))} · profesional ${avg(panels.map((panel) => panel.professional?.score))}`,
    `Arreglos por área: ${
      [...areas.entries()].map(([area, count]) => `${area} ${String(count)}`).join(' · ') || '-'
    }`,
  ].join(' · ');
}

const fixSchema = z.object({
  area: z.enum(['texto', 'dibujo', 'armado']),
  fix: z.string(),
  judge: z.string(),
});

/** Lo que queda guardado en el pedido (`judgePanel`) y muestra el admin. */
export const judgePanelSchema = z.object({
  score: z.number().nullable(),
  weakest: z.string().nullable(),
  fixes: z.array(fixSchema),
  errors: z.array(z.string()),
  costUsdMicros: z.number(),
  at: z.string().nullable(),
  buyer: z
    .object({
      buy: z.number(),
      gift: z.number(),
      verdict: z.enum(['compra', 'duda', 'no']),
      loved: z.array(z.string()),
      refund: z.array(z.string()),
      sample: z.number(),
      sampleObjection: z.string(),
      share: z.number(),
      sharePage: z.number(),
      shareWhy: z.string(),
    })
    .nullable(),
  continuity: z
    .object({
      score: z.number(),
      issues: z.array(z.object({ page: z.number(), who: z.string(), what: z.string() })),
    })
    .nullable(),
  child: z
    .object({
      score: z.number(),
      understood: z.number(),
      wantsMore: z.number(),
      hardWords: z.array(z.string()),
      lostPages: z.array(z.number()),
      favorite: z.string(),
    })
    .nullable(),
  professional: z
    .object({
      score: z.number(),
      meetsGoal: z.number(),
      wouldUse: z.boolean(),
      risks: z.array(z.string()),
    })
    .nullable(),
});

export type StoredJudgePanel = z.infer<typeof judgePanelSchema>;

/** La mesa como se guarda en el pedido: sin los arreglos de cada juez (ya están juntos). */
export function storedPanel(panel: Panel, costUsdMicros: number, at: Date): StoredJudgePanel {
  const drop = <T extends { fixes: unknown }>(review: T | undefined) => {
    if (!review) return null;
    const { fixes: _fixes, ...rest } = review;
    return rest;
  };
  return {
    score: panel.score,
    weakest: panel.weakest,
    fixes: panel.fixes,
    errors: panel.errors,
    costUsdMicros,
    at: at.toISOString(),
    buyer: drop(panel.buyer),
    continuity: drop(panel.continuity),
    child: drop(panel.child),
    professional: drop(panel.professional),
  };
}

/**
 * Freno de la mesa (DECISIONS 352, Sebas 26 nov: «la mesa frena la entrega»). Un libro se entrega
 * solo si la mesa le da 4 o más, el comprador no dice «no» y, en Profesionales, el profesional lo
 * usaría. Si la mesa no llegó a opinar (tiempo, error), no frena: un juez caído no puede dejar a
 * una familia sin su libro.
 */
export const JUDGE_GATE_MIN_SCORE = 4;
/** Código del freno en `pipeline.error` y en los avisos: así el admin y el vigía lo reconocen. */
export const JUDGE_GATE_CODE = 'judge_panel_low';
/** Tope de la revisión: pasado este tiempo sin que nadie mire, se entrega la versión que hay. */
export const JUDGE_GATE_MAX_WAIT_MS = 24 * 3600 * 1000;

type GatePanel = Pick<StoredJudgePanel, 'score' | 'weakest' | 'buyer' | 'professional'>;

export function judgeGate(
  panel: GatePanel | null | undefined,
  minScore = JUDGE_GATE_MIN_SCORE,
): { pass: boolean; reasons: string[] } {
  if (panel?.score === undefined || panel.score === null) return { pass: true, reasons: [] };
  const reasons: string[] = [];
  if (panel.score < minScore) {
    reasons.push(
      `mesa ${String(panel.score)}/5${panel.weakest ? ` (la baja ${panel.weakest})` : ''}`,
    );
  }
  if (panel.buyer?.verdict === 'no') reasons.push('el comprador no lo compraría');
  if (panel.professional && !panel.professional.wouldUse) {
    reasons.push('el profesional no lo usaría así');
  }
  return { pass: reasons.length === 0, reasons };
}

/** El mensaje del freno: empieza con el código y nombra los motivos y los arreglos de la mesa. */
export function judgeGateMessage(
  reasons: string[],
  fixes: { area: string; fix: string }[] = [],
): string {
  const head = `${JUDGE_GATE_CODE}: Mesa de jueces: ${reasons.join(' · ')}`;
  const tail =
    fixes.length > 0 ? `. Arreglos: ${fixes.map((f) => `[${f.area}] ${f.fix}`).join('; ')}` : '';
  return `${head}${tail}`.slice(0, 500);
}
