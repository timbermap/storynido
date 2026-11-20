import type { AttentionItem } from '@storynido/shared';

import { areaOfAttention, type Area } from './nav';

/** Los avisos de «Hoy» que corresponden a un área. */
export const attentionFor = (area: Area, items: AttentionItem[] | undefined): AttentionItem[] =>
  (items ?? []).filter((item) => areaOfAttention(item.kind) === area);

export const SOURCE_LABELS: Record<string, string> = {
  direct: 'Directo',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google',
  unknown: 'Sin origen',
};
export const sourceName = (key: string) =>
  SOURCE_LABELS[key] ?? (key.startsWith('ref:') ? key.slice(4) : key);

export const daysAgo = (iso: string | null, days: number) =>
  iso !== null && Date.now() - new Date(iso).getTime() < days * 86_400_000;
