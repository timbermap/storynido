import { isAdminRole, roleFromClaims, type Role, type RouteAccess } from '@storynido/shared';
import { requestSpan, traceLogFields } from '@storynido/shared/server';
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

  // Cada línea de log del request lleva su traza (Cloud Run manda la cabecera).
  app.addHook('onRequest', (request, _reply, done) => {
    const header = request.headers['x-cloud-trace-context'] ?? request.headers.traceparent;
    const fields = traceLogFields(
      Array.isArray(header) ? header[0] : header,
      app.deps.config.projectId,
    );
    if (Object.keys(fields).length > 0) request.log = request.log.child(fields);
    done();
  });

  // Y queda como un span en Cloud Trace (Cloud Run no lo guarda solo).
  app.addHook('onResponse', (request, reply, done) => {
    const spans = app.deps.spans;
    const header = request.headers['x-cloud-trace-context'] ?? request.headers.traceparent;
    const span =
      spans &&
      requestSpan(Array.isArray(header) ? header[0] : header, {
        method: request.method,
        route: request.routeOptions.url ?? 'sin ruta',
        status: reply.statusCode,
        elapsedMs: reply.elapsedTime,
        service: 'api',
      });
    if (span) spans.record(span);
    done();
  });

  app.addHook('onRequest', async (request) => {
    const header = request.headers.authorization;
    if (!header) return;
    const match = BEARER.exec(header);
    if (!match?.[1]) throw unauthorized('Header Authorization inválido.');
    try {
      const verified = await app.deps.tokens.verify(match[1]);
      const firebase = verified.claims.firebase as
        { sign_in_provider?: unknown; sign_in_second_factor?: unknown } | undefined;
      request.user = {
        uid: verified.uid,
        email: verified.email,
        role: roleFromClaims(verified.claims),
        anonymous: firebase?.sign_in_provider === 'anonymous',
        mfa: typeof firebase?.sign_in_second_factor === 'string',
      };
    } catch {
      throw unauthorized('La sesión no es válida o venció. Inicia sesión de nuevo.');
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

/** preHandler que exige sesión y el rol que pide la ruta (y 2FA en las rutas de admin). */
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
    if (!hasAccess(request.user.role, access)) {
      done(forbidden());
      return;
    }
    const adminRoute = access === 'admin' || access === 'superadmin';
    if (adminRoute && request.server.deps.config.adminMfaRequired && !request.user.mfa) {
      done(
        new AppError(
          403,
          'mfa_required',
          'El panel de administración exige verificación en dos pasos.',
        ),
      );
      return;
    }
    done();
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
