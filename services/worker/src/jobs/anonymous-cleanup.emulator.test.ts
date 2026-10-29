import type { StorageObjectRef, StorageService } from '@storynido/shared';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { FastifyBaseLogger } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';

import { AnonymousCleanup, type AnonymousAuth } from './anonymous-cleanup';

const app = getApps()[0] ?? initializeApp({ projectId: 'demo-storynido-test' });
const db = getFirestore(app);
const now = new Date('2026-10-28T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 3600 * 1000);

describe('limpieza de sesiones anónimas abandonadas', () => {
  beforeEach(async () => {
    for (const name of ['books', 'children', 'photos', 'orders', 'users'])
      await db.recursiveDelete(db.collection(name));
  });

  it('borra solo lo abandonado: nunca cuentas, sesiones activas ni a quien compró', async () => {
    const users: Record<string, { anonymous: boolean; lastActive: Date | null }> = {
      abandonada: { anonymous: true, lastActive: daysAgo(45) },
      activa: { anonymous: true, lastActive: daysAgo(2) },
      cuenta: { anonymous: false, lastActive: daysAgo(90) },
      compro: { anonymous: true, lastActive: daysAgo(90) },
      // `borrada` ya no existe en Auth (la borró Identity Platform a los 30 días).
    };
    const deletedUsers: string[] = [];
    const auth: AnonymousAuth = {
      getUser: (uid) => Promise.resolve(users[uid] ?? null),
      deleteUser: (uid) => {
        deletedUsers.push(uid);
        return Promise.resolve();
      },
    };
    const deletedFiles: StorageObjectRef[] = [];
    const storage = {
      delete: (ref: StorageObjectRef) => {
        deletedFiles.push(ref);
        return Promise.resolve();
      },
    } as unknown as StorageService;

    for (const owner of ['abandonada', 'activa', 'cuenta', 'compro', 'borrada']) {
      await db.doc(`books/libro-${owner}`).set({
        ownerUid: owner,
        status: 'draft',
        updatedAt: daysAgo(40),
        preview: { character: { imagePath: `previews/${owner}.png`, previewImagePath: null } },
      });
      await db.doc(`children/chico-${owner}`).set({ ownerUid: owner, name: 'Mía' });
      await db.doc(`photos/foto-${owner}`).set({
        ownerUid: owner,
        storagePath: `original/${owner}.jpg`,
        processedPath: null,
      });
    }
    await db.doc('orders/o1').set({ ownerUid: 'compro', status: 'ready' });

    const cleanup = new AnonymousCleanup(db, auth, () => storage, {
      info: () => undefined,
    } as unknown as FastifyBaseLogger);
    expect(await cleanup.run(now)).toEqual({ owners: 2, books: 2 });

    const left = async (name: string) =>
      (await db.collection(name).get()).docs.map((doc) => doc.get('ownerUid') as string).sort();
    for (const name of ['books', 'children', 'photos'])
      expect(await left(name)).toEqual(['activa', 'compro', 'cuenta']);
    expect(deletedUsers.sort()).toEqual(['abandonada', 'borrada']);
    expect(deletedFiles).toContainEqual({ bucket: 'assets', path: 'previews/abandonada.png' });
    expect(deletedFiles).toContainEqual({ bucket: 'photos', path: 'original/borrada.jpg' });

    // Un libro reciente de la misma sesión la mantiene viva.
    users.abandonada = { anonymous: true, lastActive: daysAgo(45) };
    await db
      .doc('books/viejo')
      .set({ ownerUid: 'abandonada', status: 'draft', updatedAt: daysAgo(40) });
    await db
      .doc('books/nuevo')
      .set({ ownerUid: 'abandonada', status: 'draft', updatedAt: daysAgo(3) });
    expect(await cleanup.run(now)).toEqual({ owners: 0, books: 0 });
  });
});
