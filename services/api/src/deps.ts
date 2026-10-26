import type { ProviderRegistry } from '@storynido/providers';
import type { SiteConfig } from '@storynido/shared';

import type { CatalogRepository } from './catalog';
import type { ApiConfig } from './config';
import type { PhotoService } from './photos/service';

export interface VerifiedUser {
  uid: string;
  email: string | null;
  claims: Readonly<Record<string, unknown>>;
}

/** Verifica ID tokens de Firebase Auth. */
export interface TokenVerifier {
  verify(idToken: string): Promise<VerifiedUser>;
}

/** Verifica tokens de Firebase App Check. */
export interface AppCheckVerifier {
  verify(token: string): Promise<boolean>;
}

/** Modo del sitio leído en tiempo real (siteConfig/global). */
export interface SiteConfigSource {
  mode(): SiteConfig['mode'];
}

export interface ApiDeps {
  config: ApiConfig;
  version: string;
  tokens: TokenVerifier;
  appCheck: AppCheckVerifier;
  siteConfig: SiteConfigSource;
  providers: ProviderRegistry;
  catalog: CatalogRepository;
  photos: PhotoService;
}

/** Fuente fija (tests y arranque antes del primer snapshot). */
export class StaticSiteConfigSource implements SiteConfigSource {
  constructor(public current: SiteConfig['mode'] = 'live') {}

  mode(): SiteConfig['mode'] {
    return this.current;
  }
}
