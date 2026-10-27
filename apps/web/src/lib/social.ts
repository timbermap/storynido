/**
 * Redes de StoryNido. Se configuran por ambiente (NEXT_PUBLIC_SOCIAL_*); una red sin URL no
 * se muestra.
 */
export const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
  { key: 'tiktok', label: 'TikTok', url: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK },
  { key: 'youtube', label: 'YouTube', url: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
].filter((link): link is { key: 'instagram' | 'tiktok' | 'youtube'; label: string; url: string } =>
  Boolean(link.url),
);
