import { getBrandConfig } from '@storynido/shared';

export const brand = getBrandConfig({
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
  NEXT_PUBLIC_BRAND_DOMAIN: process.env.NEXT_PUBLIC_BRAND_DOMAIN,
});
