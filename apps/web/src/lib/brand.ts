import { getBrandConfig } from '@micuento/shared';

export const brand = getBrandConfig({ NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME });
