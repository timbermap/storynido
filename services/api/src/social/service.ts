import {
  COLLECTIONS,
  SOCIAL_HANDLES,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import {
  SocialError,
  type SocialProvider,
  type SocialSnapshot,
  type TokenStore,
} from './providers';

export type SyncStatus = 'ok' | 'error' | 'not_connected';
export interface SyncResult {
  network: SocialNetwork;
  status: SyncStatus;
  message: string | null;
}

const DAY_MS = 24 * 3600 * 1000;
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** Token de renovación vigente de las redes que lo rotan: solo servidor (sin reglas de lectura). */
export class FirestoreTokenStore implements TokenStore {
  constructor(private readonly db: Firestore) {}
  async get(network: SocialNetwork) {
    const snap = await this.db.collection(COLLECTIONS.socialTokens).doc(network).get();
    const value = (snap.data() as { refreshToken?: unknown } | undefined)?.refreshToken;
    return typeof value === 'string' && value ? value : null;
  }
  async set(network: SocialNetwork, refreshToken: string) {
    await this.db
      .collection(COLLECTIONS.socialTokens)
      .doc(network)
      .set({ refreshToken, updatedAt: new Date().toISOString() });
  }
}

type DayDoc = Partial<Record<SocialNetwork, Partial<SocialSnapshot>>> & { day?: string };

/**
 * Lee las redes conectadas y guarda los números por día en `socialDaily/{día}` (un mapa por red).
 * Solo lectura sobre las redes: nunca publica ni modifica nada allá. Una red que falla no frena
 * a las otras; su error queda en `socialState/{red}` para mostrarlo en el admin.
 */
export class SocialService {
  private readonly byNetwork: Map<SocialNetwork, SocialProvider>;

  constructor(
    private readonly db: Firestore,
    providers: SocialProvider[],
    private readonly now: () => Date = () => new Date(),
  ) {
    this.byNetwork = new Map(providers.map((provider) => [provider.network, provider]));
  }

  async sync(days: number): Promise<SyncResult[]> {
    const today = dayOf(this.now());
    const results: SyncResult[] = [];
    for (const network of SOCIAL_NETWORKS) {
      const provider = this.byNetwork.get(network);
      if (!provider) {
        results.push({ network, status: 'not_connected', message: null });
        continue;
      }
      const state = this.db.collection(COLLECTIONS.socialState).doc(network);
      try {
        const reading = await provider.read(days, today);
        for (const [day, snapshot] of Object.entries(reading)) {
          await this.db
            .collection(COLLECTIONS.socialDaily)
            .doc(day)
            .set({ day, [network]: stripNull(snapshot) }, { merge: true });
        }
        await state.set({ lastRunAt: this.now().toISOString(), ok: true, error: null });
        results.push({ network, status: 'ok', message: null });
      } catch (error) {
        const message =
          error instanceof SocialError ? error.message : `${network}: no se pudo leer.`;
        await state.set(
          { lastRunAt: this.now().toISOString(), ok: false, error: message },
          { merge: true },
        );
        results.push({ network, status: 'error', message });
      }
    }
    return results;
  }

  async report(days: number) {
    const now = this.now();
    const refs = Array.from({ length: days }, (_, index) =>
      this.db
        .collection(COLLECTIONS.socialDaily)
        .doc(dayOf(new Date(now.getTime() - index * DAY_MS))),
    );
    const states = await this.db.getAll(
      ...SOCIAL_NETWORKS.map((network) => this.db.collection(COLLECTIONS.socialState).doc(network)),
    );
    const docs = (await this.db.getAll(...refs))
      .filter((snap) => snap.exists)
      .map((snap) => snap.data() as DayDoc & { day: string })
      .sort((a, b) => a.day.localeCompare(b.day));
    return {
      days,
      since: dayOf(new Date(now.getTime() - (days - 1) * DAY_MS)),
      networks: SOCIAL_NETWORKS.map((network, index) => {
        const state = states[index]?.data() as
          { lastRunAt?: string; error?: string | null } | undefined;
        return buildNetworkReport(
          network,
          this.byNetwork.has(network),
          state?.lastRunAt ?? null,
          state?.error ?? null,
          docs,
        );
      }),
    };
  }
}

const stripNull = (snapshot: Partial<SocialSnapshot>) =>
  Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value !== null));

/** Suma el período de una red. Un número que la red nunca informó queda en null, no en 0. */
export function buildNetworkReport(
  network: SocialNetwork,
  connected: boolean,
  lastRunAt: string | null,
  error: string | null,
  docs: (DayDoc & { day: string })[],
) {
  const series = docs.map((doc) => ({ day: doc.day, ...(doc[network] ?? {}) }));
  const sum = (key: keyof SocialSnapshot) => {
    const values = series
      .map((row) => (row as Partial<SocialSnapshot>)[key])
      .filter((value): value is number => typeof value === 'number');
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const followers = series
    .map((row) => ({ day: row.day, value: (row as Partial<SocialSnapshot>).followers }))
    .filter((row): row is { day: string; value: number } => typeof row.value === 'number');
  const latestViews = [...series]
    .reverse()
    .map((row) => (row as Partial<SocialSnapshot>).videoViews)
    .find((value): value is number => typeof value === 'number');
  return {
    network,
    handle: SOCIAL_HANDLES[network],
    connected,
    lastRunAt,
    error,
    followers: followers.at(-1)?.value ?? null,
    followersChange:
      followers.length >= 2 ? (followers.at(-1)?.value ?? 0) - (followers[0]?.value ?? 0) : null,
    impressions: sum('impressions'),
    reach: sum('reach'),
    clicks: sum('clicks'),
    profileVisits: sum('profileVisits'),
    videoViews: latestViews ?? null,
    daily: series.map((row) => {
      const r = row as Partial<SocialSnapshot>;
      return {
        day: row.day,
        followers: r.followers ?? null,
        impressions: r.impressions ?? null,
        reach: r.reach ?? null,
        clicks: r.clicks ?? null,
      };
    }),
  };
}
