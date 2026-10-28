/** Marca de los mails: configurable por ambiente (dominio, remitente y dirección postal). */
export interface EmailBrand {
  name: string;
  /** Web pública, para el logo y los enlaces del pie. */
  siteUrl: string;
  /** Dirección postal del remitente: obligatoria en los mails de marketing (CAN-SPAM). */
  postalAddress: string | null;
}

export const DEFAULT_BRAND: EmailBrand = {
  name: 'StoryNido',
  siteUrl: 'https://storynido.com',
  postalAddress: null,
};

/** Paleta de la marca (BRAND.md 2.1). */
export const COLORS = {
  background: '#fbf7f2',
  card: '#ffffff',
  ink: '#342a40',
  muted: '#69616c',
  primary: '#79518c',
  border: '#ece5ec',
} as const;
