import { z } from 'zod';

import { localeSchema } from '../i18n';
import { uidSchema } from './common';

export const SITE_MODES = ['live', 'maintenance', 'preview_only'] as const;

/** siteConfig/global: interruptor general del sitio, leído en tiempo real. */
export const siteConfigSchema = z.object({
  mode: z.enum(SITE_MODES),
  updatedAt: z.date(),
  updatedBy: z.string().nullable(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

export const AI_TEXT_PROVIDERS = ['mock', 'vertex', 'anthropic'] as const;
export const AI_IMAGE_PROVIDERS = ['mock', 'vertex', 'flux'] as const;

/** aiConfig/global: solo admin. */
export const aiConfigSchema = z.object({
  textProvider: z.enum(AI_TEXT_PROVIDERS),
  textModel: z.string().min(1),
  imageProvider: z.enum(AI_IMAGE_PROVIDERS),
  imageModel: z.string().min(1),
  maxRegenerationsPerBook: z.number().int().min(0).max(50),
  /** Vistas previas completas por usuario y por día (anti abuso). */
  maxPreviewsPerUserPerDay: z.number().int().min(1).max(100),
  /**
   * La etapa 2 de la muestra (portada y páginas, la parte cara) pide cuenta: filtra curiosos
   * y deja el contacto. La etapa 1 (texto + personaje) sigue sin cuenta.
   */
  illustrationsRequireAccount: z.boolean(),
  dailyBudgetUsd: z.number().nonnegative(),
  budgetAlertPercent: z.number().int().min(1).max(100),
  updatedAt: z.date(),
  updatedBy: z.string().nullable(),
});

export type AiConfig = z.infer<typeof aiConfigSchema>;

export const AI_USAGE_KINDS = [
  'character',
  'story',
  'review',
  'illustration',
  'moderation',
] as const;

/** aiUsage/{id}: una llamada de IA con su costo estimado. Solo servidor. */
export const aiUsageSchema = z.object({
  /** Día UTC (AAAA-MM-DD) para agrupar contra el presupuesto diario. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(AI_USAGE_KINDS),
  provider: z.string(),
  model: z.string(),
  costUsdMicros: z.number().int().nonnegative(),
  ownerUid: uidSchema.nullable(),
  bookId: z.string().nullable(),
  orderId: z.string().nullable(),
  at: z.date(),
});

export type AiUsageRecord = z.infer<typeof aiUsageSchema>;

/** aiBudget/{AAAA-MM-DD}: gasto acumulado del día. Solo servidor. */
export const aiBudgetDaySchema = z.object({
  spentUsdMicros: z.number().int().nonnegative(),
  calls: z.number().int().nonnegative(),
  /** Ya se avisó que se pasó el porcentaje de alerta. */
  alertSent: z.boolean(),
  updatedAt: z.date(),
});

export type AiBudgetDay = z.infer<typeof aiBudgetDaySchema>;

/** Día UTC en formato AAAA-MM-DD. */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export const CONTENT_KEYS = [
  'terms',
  'privacy',
  'cookies',
  'refunds',
  'shipping',
  'faq',
  'banner',
] as const;

/** content/{key}_{locale}: textos editables por idioma. */
export const contentSchema = z.object({
  key: z.enum(CONTENT_KEYS),
  locale: localeSchema,
  title: z.string().min(1),
  /** Markdown. */
  body: z.string(),
  published: z.boolean(),
  updatedAt: z.date(),
  updatedBy: z.string().nullable(),
});

export type Content = z.infer<typeof contentSchema>;

export function contentDocId(key: string, locale: string): string {
  return `${key}_${locale}`;
}

/** auditLog/{entryId}: quién cambió qué y cuándo. Solo servidor, nunca se edita. */
export const auditLogSchema = z.object({
  actorUid: uidSchema.nullable(),
  actorEmail: z.string().nullable(),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().min(1),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  at: z.date(),
});

export type AuditLogEntry = z.infer<typeof auditLogSchema>;
