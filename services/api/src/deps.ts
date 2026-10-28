import type { EmailNotifier } from '@storynido/emails';
import type { ProService } from './pro/service';
import type { ProviderRegistry } from '@storynido/providers';
import type { SiteConfig } from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import type { AccountService } from './accounts/service';
import type { CatalogRepository } from './catalog';
import type { CheckoutService } from './checkout/service';
import type { PipelineEventPublisher } from './orders/events';
import type { FulfillmentService } from './orders/fulfillment';
import type { ApiConfig } from './config';
import type { PhotoService } from './photos/service';
import type { PreviewService } from './preview/service';

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
  previews: PreviewService;
  accounts: AccountService;
  checkout: CheckoutService;
  fulfillment: FulfillmentService;
  /** StoryNido Profesionales: cuenta Pro y descuento por recurrencia. */
  pro: ProService;
  /** Mails al cliente y alertas al equipo (idempotentes). */
  notifier: EmailNotifier;
  /** Eventos del pipeline del pedido (worker directo en local, Pub/Sub en la nube). */
  pipelineEvents: PipelineEventPublisher;
  db: Firestore;
}

/** Fuente fija (tests y arranque antes del primer snapshot). */
export class StaticSiteConfigSource implements SiteConfigSource {
  constructor(public current: SiteConfig['mode'] = 'live') {}

  mode(): SiteConfig['mode'] {
    return this.current;
  }
}
