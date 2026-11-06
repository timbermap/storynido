import type { PrintAddress } from '@storynido/shared';
import { GoogleAuth } from 'google-auth-library';

/**
 * Google Address Validation antes de mandar un impreso a la imprenta (DECISIONS 235). Se llama
 * con la cuenta de servicio del worker (OAuth), sin clave de API. Solo marca para revisar: nunca
 * corrige la dirección sola.
 */

/** Países que cubre Address Validation (lista de Google, sin Uruguay ni Perú). */
export const ADDRESS_VALIDATION_COUNTRIES = [
  'AR',
  'AT',
  'AU',
  'BE',
  'BG',
  'BR',
  'CA',
  'CH',
  'CL',
  'CO',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GB',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MX',
  'MY',
  'NL',
  'NO',
  'NZ',
  'PL',
  'PR',
  'PT',
  'SE',
  'SG',
  'SI',
  'SK',
  'US',
] as const;

export interface AddressVerdict {
  /** ok: se puede entregar · fix: Google dice que hay que corregirla · unsupported: país sin datos. */
  status: 'ok' | 'fix' | 'unsupported';
  /** Lo que faltó o no se pudo confirmar (route, street_number, locality…), para el admin. */
  reasons: string[];
  /** Dónde ubica Google la dirección escrita. */
  location: { lat: number; lng: number } | null;
}

export interface AddressValidator {
  validate(address: PrintAddress): Promise<AddressVerdict>;
}

interface ValidationResponse {
  result?: {
    verdict?: {
      possibleNextAction?: string;
      addressComplete?: boolean;
      validationGranularity?: string;
    };
    address?: {
      missingComponentTypes?: string[];
      unconfirmedComponentTypes?: string[];
    };
    geocode?: { location?: { latitude?: number; longitude?: number } };
  };
}

/** Lo que pesa para la entrega: sin calle, número o ciudad confirmados, el correo no llega. */
const CRITICAL = new Set(['route', 'street_number', 'locality', 'postal_code']);

/** Lee la respuesta de Google y decide si la dirección se puede entregar. */
export function verdictFrom(response: ValidationResponse): AddressVerdict {
  const result = response.result ?? {};
  const missing = result.address?.missingComponentTypes ?? [];
  const unconfirmed = result.address?.unconfirmedComponentTypes ?? [];
  const reasons = [
    ...missing.filter((type) => CRITICAL.has(type)).map((type) => `falta ${type}`),
    ...unconfirmed.filter((type) => CRITICAL.has(type)).map((type) => `no confirmado ${type}`),
  ];
  const latitude = result.geocode?.location?.latitude;
  const longitude = result.geocode?.location?.longitude;
  const location =
    typeof latitude === 'number' && typeof longitude === 'number'
      ? { lat: latitude, lng: longitude }
      : null;
  const fix =
    result.verdict?.possibleNextAction === 'FIX' ||
    // Respuestas sin possibleNextAction: incompleta y sin llegar ni a la calle.
    (result.verdict?.possibleNextAction === undefined &&
      result.verdict?.addressComplete === false &&
      ['OTHER', 'GRANULARITY_UNSPECIFIED', undefined].includes(
        result.verdict.validationGranularity,
      ));
  return { status: fix ? 'fix' : 'ok', reasons, location };
}

export class GoogleAddressValidator implements AddressValidator {
  private readonly auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  constructor(
    private readonly options: {
      /** Proyecto que se factura (X-Goog-User-Project). */
      projectId: string;
      fetchImpl?: typeof fetch;
      getAccessToken?: () => Promise<string>;
      timeoutMs?: number;
    },
  ) {}

  async validate(address: PrintAddress): Promise<AddressVerdict> {
    if (!(ADDRESS_VALIDATION_COUNTRIES as readonly string[]).includes(address.country)) {
      return { status: 'unsupported', reasons: [], location: null };
    }
    const token = this.options.getAccessToken
      ? await this.options.getAccessToken()
      : await this.auth.getAccessToken();
    if (!token) throw new Error('Sin credenciales para Address Validation');
    const doFetch = this.options.fetchImpl ?? fetch;
    const response = await doFetch('https://addressvalidation.googleapis.com/v1:validateAddress', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Goog-User-Project': this.options.projectId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: {
          regionCode: address.country,
          addressLines: [address.line1, address.line2].filter(Boolean),
          locality: address.city,
          ...(address.state ? { administrativeArea: address.state } : {}),
          postalCode: address.postalCode,
        },
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
    });
    if (!response.ok) {
      throw new Error(`Address Validation respondió ${String(response.status)}`);
    }
    return verdictFrom((await response.json()) as ValidationResponse);
  }
}
