import { z } from 'zod';

/**
 * Monedas conocidas. Se cobra siempre en USD (DECISIONS 097); el resto se usa como referencia
 * ("≈ ARS 25.000") y en los países con configuración propia.
 */
export const CURRENCIES = [
  'MXN',
  'USD',
  'EUR',
  'COP',
  'CLP',
  'PEN',
  'BRL',
  'ARS',
  'UYU',
  'BOB',
  'PYG',
  'GTQ',
  'HNL',
  'NIO',
  'CRC',
  'DOP',
  'VES',
] as const;

export const currencySchema = z.enum(CURRENCIES);

export type Currency = z.infer<typeof currencySchema>;

/** Decimales de la unidad mínima de cada moneda, según cómo las cobra Stripe. */
export const CURRENCY_MINOR_UNITS: Record<Currency, number> = {
  MXN: 2,
  USD: 2,
  EUR: 2,
  COP: 2,
  CLP: 0,
  PEN: 2,
  BRL: 2,
  ARS: 2,
  UYU: 2,
  BOB: 2,
  PYG: 0,
  GTQ: 2,
  HNL: 2,
  NIO: 2,
  CRC: 2,
  DOP: 2,
  VES: 2,
};

/** Los montos se guardan siempre como enteros en la unidad mínima (centavos). */
export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: currencySchema,
});

export type Money = z.infer<typeof moneySchema>;

export function toMinorUnits(amount: number, currency: Currency): number {
  return Math.round(amount * 10 ** CURRENCY_MINOR_UNITS[currency]);
}

export function fromMinorUnits(amountMinor: number, currency: Currency): number {
  return amountMinor / 10 ** CURRENCY_MINOR_UNITS[currency];
}

export function formatMoney(money: Money, locale: string): string {
  const digits = CURRENCY_MINOR_UNITS[money.currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fromMinorUnits(money.amountMinor, money.currency));
}
