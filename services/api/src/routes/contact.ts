import { createHash } from 'node:crypto';

import { COLLECTIONS, apiRoutes } from '@storynido/shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

/** Mensajes por conexión y por día: suficiente para una persona, poco para un bot. */
export const CONTACT_DAILY_LIMIT = 5;

type ContactBody = z.output<(typeof apiRoutes)['contact']['body']>;
type LoginEventBody = z.output<(typeof apiRoutes)['loginEvent']['body']>;

/**
 * Formulario de contacto (sin el mail del equipo a la vista) y contadores del login. El mensaje queda guardado y llega
 * al equipo; nunca se manda nada a la dirección que escribió la persona.
 */
export function registerContactRoutes(app: FastifyInstance): void {
  const { deps } = app;

  // Login por navegador: solo contadores del día (en el login no corre Google Analytics).
  addRoute(app, apiRoutes.loginEvent, {}, async (request) => {
    const { stage, method, via, browser } = request.body as LoginEventBody;
    const day = new Date().toISOString().slice(0, 10);
    await deps.db
      .collection(COLLECTIONS.loginMetrics)
      .doc(day)
      .set(
        { day, counts: { [`${browser}_${method}_${via}_${stage}`]: FieldValue.increment(1) } },
        { merge: true },
      );
    return { ok: true as const };
  });

  addRoute(app, apiRoutes.contact, {}, async (request) => {
    const body = request.body as ContactBody;
    // Trampa para bots: se responde como si nada, sin guardar ni mandar.
    if (body.website) return { sent: true as const };

    const day = new Date().toISOString().slice(0, 10);
    const ipHash = createHash('sha256').update(`${request.ip}|${day}`).digest('hex').slice(0, 32);
    const limitRef = deps.db.collection(COLLECTIONS.contactLimits).doc(`${day}_${ipHash}`);
    await deps.db.runTransaction(async (tx) => {
      const count = Number((await tx.get(limitRef)).get('count') ?? 0);
      if (count >= CONTACT_DAILY_LIMIT) {
        throw new AppError(
          429,
          'rate_limited',
          'Recibimos varios mensajes desde tu conexión hoy. Inténtalo de nuevo mañana.',
        );
      }
      tx.set(limitRef, { count: count + 1, day, updatedAt: new Date() }, { merge: true });
    });

    const ref = deps.db.collection(COLLECTIONS.contactMessages).doc();
    const message = {
      name: body.name,
      email: body.email.toLowerCase(),
      topic: body.topic,
      message: body.message,
      locale: body.locale,
      page: body.page,
      uid: request.user?.uid ?? null,
      createdAt: new Date(),
    };
    await ref.set(message);
    await deps.notifier.contactMessage(`contact:${ref.id}`, {
      name: message.name,
      email: message.email,
      topic: message.topic,
      message: message.message,
      locale: message.locale,
      page: message.page,
    });
    return { sent: true as const };
  });
}
