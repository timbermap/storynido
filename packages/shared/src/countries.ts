import { z } from 'zod';

import type { Currency } from './currency';
import type { Locale } from './i18n';

export const COUNTRY_CODES = ['MX', 'US', 'ES', 'CO', 'CL', 'PE', 'BR'] as const;

export const countryCodeSchema = z.enum(COUNTRY_CODES);

export type CountryCode = z.infer<typeof countryCodeSchema>;

/** Fase del plan de lanzamiento en la que se habilita cada país. */
export type LaunchPhase = 1 | 2 | 3 | 4;

export interface CountryDefaults {
  code: CountryCode;
  currency: Currency;
  defaultLocale: Locale;
  launchPhase: LaunchPhase;
}

/**
 * Valores iniciales por país. La activación, los precios, impuestos y envíos
 * se configuran en Firestore desde el panel admin; esto solo siembra los datos.
 */
export const COUNTRY_DEFAULTS: Record<CountryCode, CountryDefaults> = {
  MX: { code: 'MX', currency: 'MXN', defaultLocale: 'es', launchPhase: 1 },
  US: { code: 'US', currency: 'USD', defaultLocale: 'en', launchPhase: 1 },
  ES: { code: 'ES', currency: 'EUR', defaultLocale: 'es', launchPhase: 2 },
  CO: { code: 'CO', currency: 'COP', defaultLocale: 'es', launchPhase: 3 },
  CL: { code: 'CL', currency: 'CLP', defaultLocale: 'es', launchPhase: 3 },
  PE: { code: 'PE', currency: 'PEN', defaultLocale: 'es', launchPhase: 3 },
  BR: { code: 'BR', currency: 'BRL', defaultLocale: 'pt', launchPhase: 3 },
};
