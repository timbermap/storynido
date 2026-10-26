import { z } from 'zod';

export const DEFAULT_BRAND_NAME = 'StoryNido';
export const DEFAULT_BRAND_DOMAIN = 'storynido.com';

export const brandConfigSchema = z.object({
  name: z.string().trim().min(1).max(60).default(DEFAULT_BRAND_NAME),
  /** Dominio principal, sin protocolo. Los subdominios (admin, api) se derivan de él. */
  domain: z.hostname().default(DEFAULT_BRAND_DOMAIN),
});

export type BrandConfig = z.infer<typeof brandConfigSchema>;

/**
 * Lee la configuración de marca desde variables de entorno.
 * Acepta `BRAND_*` (servidor) o `NEXT_PUBLIC_BRAND_*` (cliente).
 */
export function getBrandConfig(env: Record<string, string | undefined>): BrandConfig {
  return brandConfigSchema.parse({
    name: env.BRAND_NAME ?? env.NEXT_PUBLIC_BRAND_NAME,
    domain: env.BRAND_DOMAIN ?? env.NEXT_PUBLIC_BRAND_DOMAIN,
  });
}
