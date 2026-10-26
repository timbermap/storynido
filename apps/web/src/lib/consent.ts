export const CONSENT_COOKIE = 'sn_consent';
const VERSION = 'v1';

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
}

/** Formato de la cookie: "v1.a1.m0". Una versión distinta obliga a preguntar de nuevo. */
export function serializeConsent(choice: ConsentChoice): string {
  return `${VERSION}.a${choice.analytics ? 1 : 0}.m${choice.marketing ? 1 : 0}`;
}

export function parseConsent(value: string | null | undefined): ConsentChoice | null {
  const match = /^v1\.a([01])\.m([01])$/.exec(value ?? '');
  if (!match) return null;
  return { analytics: match[1] === '1', marketing: match[2] === '1' };
}
