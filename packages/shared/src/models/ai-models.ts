import { z } from 'zod';

/** Ambientes donde se puede activar un modelo. */
export const AI_ENVIRONMENTS = ['local', 'staging', 'production'] as const;

/**
 * aiModels/{modelo}: catálogo editable de modelos de IA (fase 14). Reemplaza la tabla fija de
 * precios y guarda la política de datos de cada proveedor para que el sistema haga cumplir las
 * reglas aunque el admin se equivoque.
 */
export const aiModelSchema = z.object({
  provider: z.string().min(1),
  model: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
  kind: z.enum(['text', 'image']),
  /** Precio de lista en USD por millón de tokens (la imagen también se cobra por tokens). */
  price: z
    .object({
      inputPerMTok: z.number().nonnegative(),
      outputPerMTok: z.number().nonnegative(),
    })
    .nullable(),
  dataPolicy: z.object({
    /** El proveedor entrena con lo que le mandamos. */
    trainsOnData: z.boolean(),
    /** Puede haber revisión humana del contenido. */
    humanReview: z.boolean(),
    /** Dónde procesa los datos (texto libre: "us", "eu", "global"). */
    regions: z.array(z.string().min(1)),
    /** Contrato de datos empresarial (sin entrenamiento) firmado. */
    enterpriseAgreement: z.boolean(),
  }),
  allowedEnvironments: z.array(z.enum(AI_ENVIRONMENTS)).min(1),
  /** Puede recibir fotos de chicos (personaje con foto). */
  childPhotosAllowed: z.boolean(),
  /** Última evaluación (`pnpm eval:character`): fecha, resultado y dónde está el reporte. */
  lastEval: z
    .object({ date: z.string(), summary: z.string().max(300), reportUrl: z.string().nullable() })
    .nullable(),
  notes: z.string().max(500).nullable(),
});

export type AiModelEntry = z.infer<typeof aiModelSchema>;

/** Precio que se usa si el modelo no tiene uno cargado: el peor caso conocido. */
export const WORST_CASE_PRICE = { inputPerMTok: 2, outputPerMTok: 120 } as const;

/** Un modelo que entrena con los datos o tiene revisión humana nunca recibe datos de chicos. */
export const handlesChildData = (entry: Pick<AiModelEntry, 'dataPolicy'>) =>
  !entry.dataPolicy.trainsOnData && !entry.dataPolicy.humanReview;

/**
 * Por qué no se puede activar este modelo en este ambiente (vacío: se puede). Las reglas se
 * aplican siempre, aunque el admin lo intente:
 * - tiene que estar permitido en el ambiente;
 * - en producción, nunca uno que entrena con los datos o tiene revisión humana;
 * - fuera de producción se puede probar, pero solo con datos sintéticos (lo avisa el panel).
 */
export function aiModelProblems(
  entry: AiModelEntry,
  environment: (typeof AI_ENVIRONMENTS)[number],
): string[] {
  const problems: string[] = [];
  if (!entry.allowedEnvironments.includes(environment)) {
    problems.push(`${entry.model} no está habilitado en ${environment}.`);
  }
  if (environment === 'production' && !handlesChildData(entry)) {
    problems.push(
      `${entry.model} entrena con los datos o tiene revisión humana: no se puede usar en producción.`,
    );
  }
  return problems;
}

/** Fotos: solo modelos que las admiten y que no entrenan ni revisan con personas. */
export const acceptsChildPhotos = (entry: AiModelEntry) =>
  entry.childPhotosAllowed && handlesChildData(entry);

/** Precios del catálogo por modelo (los documentos inválidos o sin precio se saltean). */
export function catalogPrices(
  docs: readonly unknown[],
): Record<string, { inputPerMTok: number; outputPerMTok: number }> {
  const prices: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {};
  for (const doc of docs) {
    const parsed = aiModelSchema.safeParse(doc);
    if (parsed.success && parsed.data.price) prices[parsed.data.model] = parsed.data.price;
  }
  return prices;
}
