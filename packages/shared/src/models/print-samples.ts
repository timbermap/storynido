import type { CountryCode } from '../countries';
import type { Address } from './commerce';

/**
 * Direcciones de ejemplo (una por país) para cotizar con las imprentas antes de tener la
 * dirección real: el estimado de la muestra y las landings, y la actualización diaria de la
 * matriz de imprentas (DECISIONS 241). Donde la imprenta exige documento del destinatario (Lulu en
 * AR, MX y BR) llevan uno de ejemplo con dígito verificador válido: sin él, la cotización falla.
 */
export const SAMPLE_PRINT_ADDRESSES: Partial<Record<CountryCode, Omit<Address, 'country'>>> = {
  AR: {
    name: 'Estimación',
    line1: 'Av. Santa Fe 1000',
    line2: null,
    city: 'Buenos Aires',
    state: 'CABA',
    postalCode: 'C1059',
    phone: '+541150000000',
    taxId: '20-12345678-6',
  },
  MX: {
    name: 'Estimación',
    line1: 'Av. Reforma 100',
    line2: null,
    city: 'Ciudad de México',
    state: 'CDMX',
    postalCode: '06600',
    phone: '+525550000000',
    taxId: 'XAXX010101000',
  },
  US: {
    name: 'Estimación',
    line1: '100 Congress Ave',
    line2: null,
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    phone: '+15125550100',
    taxId: null,
  },
  ES: {
    name: 'Estimación',
    line1: 'Calle Mayor 1',
    line2: null,
    city: 'Madrid',
    state: 'Madrid',
    postalCode: '28013',
    phone: '+34910000000',
    taxId: null,
  },
  CL: {
    name: 'Estimación',
    line1: 'Av. Providencia 1000',
    line2: null,
    city: 'Santiago',
    state: 'RM',
    postalCode: '7500000',
    phone: '+56220000000',
    taxId: '12.345.678-5',
  },
  CO: {
    name: 'Estimación',
    line1: 'Carrera 7 # 32-16',
    line2: null,
    city: 'Bogotá',
    state: 'DC',
    postalCode: '110111',
    phone: '+576010000000',
    taxId: null,
  },
  PE: {
    name: 'Estimación',
    line1: 'Av. Arequipa 1000',
    line2: null,
    city: 'Lima',
    state: 'Lima',
    postalCode: '15046',
    phone: '+5110000000',
    taxId: '12345678',
  },
  BR: {
    name: 'Estimação',
    line1: 'Av. Paulista 1000',
    line2: null,
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01310-100',
    phone: '+551130000000',
    taxId: '529.982.247-25',
  },
  UY: {
    name: 'Estimación',
    line1: 'Av. 18 de Julio 1000',
    line2: null,
    city: 'Montevideo',
    state: 'Montevideo',
    postalCode: '11100',
    phone: '+59820000000',
    taxId: null,
  },
};
