import { z } from 'zod';

export const DEFAULT_BRAND_NAME = 'MiCuento';

export const brandConfigSchema = z.object({
  name: z.string().trim().min(1).max(60).default(DEFAULT_BRAND_NAME),
});

export type BrandConfig = z.infer<typeof brandConfigSchema>;

/**
 * Lee la configuración de marca desde variables de entorno.
 * Acepta `BRAND_NAME` (servidor) o `NEXT_PUBLIC_BRAND_NAME` (cliente).
 */
export function getBrandConfig(env: Record<string, string | undefined>): BrandConfig {
  return brandConfigSchema.parse({
    name: env.BRAND_NAME ?? env.NEXT_PUBLIC_BRAND_NAME,
  });
}
