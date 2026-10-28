import { formatMoney, type Currency } from '@storynido/shared';

export const money = (minor: unknown, currency: unknown) =>
  typeof minor === 'number' && typeof currency === 'string'
    ? formatMoney({ amountMinor: minor, currency: currency as Currency }, 'es')
    : '—';

export const day = (value: unknown) =>
  typeof value === 'string' ? new Date(value).toLocaleDateString('es', { timeZone: 'UTC' }) : '—';

export const yesNo = (value: unknown) => (value === true ? 'Sí' : 'No');
