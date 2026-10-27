import type { Role } from '@storynido/shared';

import type { ApiDeps } from './deps';

export interface RequestUser {
  uid: string;
  email: string | null;
  role: Role;
  /** Sesión anónima del creador (todavía sin cuenta). */
  anonymous: boolean;
}

/** Cuándo responde una ruta según el modo del sitio. */
export type Availability = 'always' | 'normal' | 'live_only';

declare module 'fastify' {
  interface FastifyInstance {
    deps: ApiDeps;
  }

  interface FastifyRequest {
    user: RequestUser | null;
  }

  interface FastifyContextConfig {
    availability?: Availability;
  }
}
