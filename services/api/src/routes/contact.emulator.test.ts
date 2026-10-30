import { COLLECTIONS } from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { createTestApp } from '../test-helpers';

import { CONTACT_DAILY_LIMIT } from './contact';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));

type Created = Awaited<ReturnType<typeof createTestApp>>;

const body = (overrides: Record<string, unknown> = {}) => ({
  name: 'Laura',
  email: 'Laura@Example.com',
  topic: 'order',
  message: '¿Puedo cambiar la dirección de envío de mi pedido?',
  locale: 'es',
  page: '/es',
  ...overrides,
});

describe('formulario de contacto', () => {
  let created: Created;

  beforeAll(async () => {
    created = await createTestApp();
  });

  afterAll(async () => {
    await created.app.close();
  });

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.contactMessages,
      COLLECTIONS.contactLimits,
      COLLECTIONS.emailLog,
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  const post = (payload: Record<string, unknown>) =>
    created.app.inject({ method: 'POST', url: '/v1/contact', payload });

  it('guarda el mensaje y lo manda al equipo, con Responder a quien escribió', async () => {
    const send = vi.spyOn(created.providers.email(), 'send');
    const res = await post(body());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: true });
    const saved = await db.collection(COLLECTIONS.contactMessages).get();
    expect(saved.size).toBe(1);
    expect(saved.docs[0]?.data()).toMatchObject({ email: 'laura@example.com', topic: 'order' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: 'equipo@storynido.test',
      template: 'contact_message',
      replyTo: 'laura@example.com',
    });
    send.mockRestore();
  });

  it('un bot que completa el campo oculto no guarda ni manda nada', async () => {
    const send = vi.spyOn(created.providers.email(), 'send');
    expect((await post(body({ website: 'https://spam.example' }))).statusCode).toBe(200);
    expect((await db.collection(COLLECTIONS.contactMessages).get()).size).toBe(0);
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });

  it('valida los datos y corta después del tope diario por conexión', async () => {
    expect((await post(body({ email: 'no-es-un-mail' }))).statusCode).toBe(400);
    expect((await post(body({ message: 'corto' }))).statusCode).toBe(400);
    for (let i = 0; i < CONTACT_DAILY_LIMIT; i += 1) {
      expect((await post(body())).statusCode).toBe(200);
    }
    expect((await post(body())).statusCode).toBe(429);
  });
});
