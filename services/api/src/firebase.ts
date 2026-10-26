import type { ProviderRegistry } from '@storynido/providers';
import { COLLECTIONS, GLOBAL_DOC_ID, SITE_MODES, type SiteConfig } from '@storynido/shared';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { FastifyBaseLogger } from 'fastify';

import type { AppCheckVerifier, SiteConfigSource, TokenVerifier, VerifiedUser } from './deps';

/**
 * Admin SDK con las credenciales del entorno (cuenta de servicio en Cloud Run).
 * Con FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST usa los emuladores.
 */
export function initFirebaseAdmin(projectId: string): App {
  return getApps()[0] ?? initializeApp({ projectId });
}

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly app: App) {}

  async verify(idToken: string): Promise<VerifiedUser> {
    const decoded = await getAuth(this.app).verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null, claims: decoded };
  }
}

/** Borrado de usuarios de Firebase Auth (sesiones anónimas ya traspasadas). */
export class FirebaseAuthAccounts {
  constructor(private readonly app: App) {}

  async deleteUser(uid: string): Promise<void> {
    await getAuth(this.app).deleteUser(uid);
  }
}

export class FirebaseAppCheckVerifier implements AppCheckVerifier {
  constructor(private readonly app: App) {}

  async verify(token: string): Promise<boolean> {
    try {
      await getAppCheck(this.app).verifyToken(token);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Escucha siteConfig/global y aiConfig/global en tiempo real: el modo del sitio y el
 * proveedor de IA cambian desde el admin sin redeploy. Ante un error conserva el último valor.
 */
export class FirestoreLiveConfig implements SiteConfigSource {
  private currentMode: SiteConfig['mode'] = 'live';
  private readonly unsubscribers: (() => void)[] = [];

  constructor(
    private readonly app: App,
    private readonly providers: ProviderRegistry,
    private readonly log: FastifyBaseLogger,
  ) {}

  start(): void {
    const db = getFirestore(this.app);

    this.unsubscribers.push(
      db
        .collection(COLLECTIONS.siteConfig)
        .doc(GLOBAL_DOC_ID)
        .onSnapshot(
          (snapshot) => {
            const mode: unknown = snapshot.get('mode');
            this.currentMode = (SITE_MODES as readonly unknown[]).includes(mode)
              ? (mode as SiteConfig['mode'])
              : 'live';
            this.log.info({ mode: this.currentMode }, 'site mode updated');
          },
          (error) => {
            this.log.error({ err: error }, 'siteConfig listener failed');
          },
        ),
    );

    this.unsubscribers.push(
      db
        .collection(COLLECTIONS.aiConfig)
        .doc(GLOBAL_DOC_ID)
        .onSnapshot(
          (snapshot) => {
            const field = (name: string) => {
              const value: unknown = snapshot.get(name);
              return typeof value === 'string' && value !== '' ? value : undefined;
            };
            try {
              this.providers.setAiOverride({
                text: field('textProvider'),
                image: field('imageProvider'),
                textModel: field('textModel'),
                imageModel: field('imageModel'),
              });
              this.log.info({ providers: this.providers.describe().active }, 'ai config updated');
            } catch (error) {
              this.log.error({ err: error }, 'ai config rejected; keeping previous providers');
            }
          },
          (error) => {
            this.log.error({ err: error }, 'aiConfig listener failed');
          },
        ),
    );
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
  }

  mode(): SiteConfig['mode'] {
    return this.currentMode;
  }
}
