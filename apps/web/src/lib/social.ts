/**
 * Redes de StoryNido. Se configuran por ambiente (NEXT_PUBLIC_SOCIAL_*); una red sin URL no
 * se muestra.
 */
type SocialKey = 'instagram' | 'tiktok' | 'pinterest' | 'facebook' | 'youtube';

export const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
  { key: 'tiktok', label: 'TikTok', url: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK },
  { key: 'pinterest', label: 'Pinterest', url: process.env.NEXT_PUBLIC_SOCIAL_PINTEREST },
  { key: 'facebook', label: 'Facebook', url: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK },
  { key: 'youtube', label: 'YouTube', url: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
].filter((link): link is { key: SocialKey; label: string; url: string } => Boolean(link.url));
