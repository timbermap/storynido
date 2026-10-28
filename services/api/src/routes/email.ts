import { COLLECTIONS, type Locale } from '@storynido/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const DONE: Record<Locale, { title: string; text: string }> = {
  es: {
    title: 'Listo',
    text: 'No vas a recibir más correos de novedades. Los avisos de tus pedidos siguen llegando.',
  },
  en: {
    title: 'Done',
    text: 'You won’t receive any more news emails. Updates about your orders will still arrive.',
  },
  pt: {
    title: 'Pronto',
    text: 'Você não vai receber mais e-mails de novidades. Os avisos dos seus pedidos continuam chegando.',
  },
};

/**
 * Baja de los mails de marketing con un enlace firmado (sin iniciar sesión). Acepta GET (el
 * enlace del mail) y POST (la baja en un clic de Gmail y Outlook, RFC 8058).
 */
export function registerEmailRoutes(app: FastifyInstance): void {
  const { deps } = app;
  const handler = async (
    request: FastifyRequest<{ Querystring: { u?: string; t?: string } }>,
    reply: FastifyReply,
  ) => {
    const { u: uid, t: token } = request.query;
    if (!uid || !token || !deps.notifier.verifyUnsubscribe(uid, token)) {
      return reply.code(400).type('text/plain; charset=utf-8').send('Enlace inválido.');
    }
    const ref = deps.db.collection(COLLECTIONS.users).doc(uid);
    const user = (await ref.get()).data();
    if (user) await ref.update({ marketingOptIn: false, unsubscribedAt: new Date() });
    const saved: unknown = user?.locale;
    const locale: Locale = saved === 'en' || saved === 'pt' ? saved : 'es';
    if (request.method === 'POST') return reply.send({ unsubscribed: true });
    const copy = DONE[locale];
    return reply
      .type('text/html; charset=utf-8')
      .send(
        `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StoryNido</title><body style="margin:0;background:#fbf7f2;color:#342a40;font-family:system-ui,sans-serif"><main style="max-width:480px;margin:15vh auto;padding:0 16px"><p style="color:#79518c;font-weight:600">StoryNido</p><h1 style="font-weight:500">${copy.title}</h1><p style="line-height:1.6">${copy.text}</p></main></body></html>`,
      );
  };
  app.get('/v1/email/unsubscribe', handler);
  app.post('/v1/email/unsubscribe', handler);
}
