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
  dailyBudgetUsd: z.number().nonnegative(),
  budgetAlertPercent: z.number().int().min(1).max(100),
  updatedAt: z.date(),
  updatedBy: z.string().nullable(),
});

export type AiConfig = z.infer<typeof aiConfigSchema>;

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
