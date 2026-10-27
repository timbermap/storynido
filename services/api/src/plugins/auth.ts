import { isAdminRole, roleFromClaims, type Role, type RouteAccess } from '@storynido/shared';
import type {
  FastifyInstance,
  FastifyRequest,
  preHandlerAsyncHookHandler,
  preHandlerHookHandler,
} from 'fastify';

import { AppError, forbidden, unauthorized } from '../errors';

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Lee el header Authorization en cada request. Sin header, el usuario es anónimo;
 * con un token inválido o vencido, responde 401.
 */
export function registerAuthentication(app: FastifyInstance): void {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization;
    if (!header) return;
    const match = BEARER.exec(header);
    if (!match?.[1]) throw unauthorized('Header Authorization inválido.');
    try {
      const verified = await app.deps.tokens.verify(match[1]);
      request.user = {
        uid: verified.uid,
        email: verified.email,
        role: roleFromClaims(verified.claims),
        anonymous:
          (verified.claims.firebase as { sign_in_provider?: unknown } | undefined)
            ?.sign_in_provider === 'anonymous',
      };
    } catch {
      throw unauthorized('La sesión no es válida o venció. Iniciá sesión de nuevo.');
    }
  });
}

function hasAccess(role: Role, access: RouteAccess): boolean {
  switch (access) {
    case 'public':
    case 'user':
      return true;
    case 'admin':
      return isAdminRole(role);
    case 'superadmin':
      return role === 'superadmin';
  }
}

/** preHandler que exige sesión y el rol que pide la ruta. */
export function requireAccess(access: RouteAccess): preHandlerHookHandler {
  return (request: FastifyRequest, _reply, done) => {
    if (access === 'public') {
      done();
      return;
    }
    if (!request.user) {
      done(unauthorized());
      return;
    }
    done(hasAccess(request.user.role, access) ? undefined : forbidden());
  };
}

/** preHandler que exige un token de App Check válido (si está activado). */
export const requireAppCheck: preHandlerAsyncHookHandler = async (request) => {
  const { config, appCheck } = request.server.deps;
  if (!config.appCheckEnforced) return;
  const token = request.headers['x-firebase-appcheck'];
  if (typeof token !== 'string' || !(await appCheck.verify(token))) {
    throw new AppError(
      401,
      'app_check_failed',
      'No pudimos verificar que la solicitud venga de nuestra app.',
    );
  }
};
