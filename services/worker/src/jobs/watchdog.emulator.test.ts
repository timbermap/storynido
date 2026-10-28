import { EmailNotifier } from '@storynido/emails';
import { MockEmailProvider } from '@storynido/providers';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { FastifyBaseLogger } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';

import { PipelineWatchdog } from './watchdog';

const app = getApps()[0] ?? initializeApp({ projectId: 'demo-storynido-test' });
const db = getFirestore(app);

describe('vigía del pipeline', () => {
  beforeEach(async () => {
    for (const name of ['orders', 'emailLog']) await db.recursiveDelete(db.collection(name));
  });

  it('avisa los pedidos que llevan más de 2 horas generando (una vez por ejecución)', async () => {
    const now = new Date('2026-10-28T12:00:00Z');
    const order = (id: string, minutesAgo: number, status = 'generating') =>
      db.doc(`orders/${id}`).set({
        status,
        ownerUid: 'u1',
        pipeline: { runId: `run-${id}`, startedAt: new Date(now.getTime() - minutesAgo * 60_000) },
      });
    await order('viejo', 180);
    await order('nuevo', 30);
    await order('listo', 300, 'ready');
    const sent: string[] = [];
    const notifier = new EmailNotifier(
      db,
      () => new MockEmailProvider((message) => sent.push(message.to)),
      {
        webUrl: 'https://storynido.test',
        apiUrl: 'https://api.storynido.test',
        linkSecret: 'x',
        adminEmails: ['equipo@storynido.test'],
        adminUrl: 'https://admin.storynido.test',
      },
    );
    const watchdog = new PipelineWatchdog(
      db,
      notifier,
      { error: () => undefined } as unknown as FastifyBaseLogger,
      'p',
    );
    expect(await watchdog.run(now)).toEqual({ stuck: ['viejo'] });
    expect(sent).toHaveLength(1);
    await watchdog.run(now);
    expect(sent).toHaveLength(1);
  });
});
