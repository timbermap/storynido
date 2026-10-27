import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { createTestEnv } from './setup';

let env: RulesTestEnvironment;

const ALICE = 'alice';
const BOB = 'bob';

function db(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const context =
    uid === null
      ? env.unauthenticatedContext()
      : env.authenticatedContext(uid, { email: `${uid}@storynido.test`, ...claims });
  return context.firestore() as unknown as Firestore;
}

const alice = () => db(ALICE);
const bob = () => db(BOB);
const admin = () => db('admin-1', { role: 'admin' });
const anon = () => db(null);

const userProfile = (uid: string) => ({
  email: `${uid}@storynido.test`,
  displayName: 'Alice',
  photoURL: null,
  locale: 'es',
  country: 'MX',
  marketingOptIn: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const child = (ownerUid: string) => ({
  ownerUid,
  name: 'Martina',
  age: 5,
  pronouns: 'she',
  likes: ['dinosaurios', 'espacio'],
  petName: null,
  bestFriendName: 'Tomi',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const draftBook = (ownerUid: string, childId: string | null = null) => ({
  ownerUid,
  status: 'draft',
  childId,
  storyId: null,
  styleId: null,
  lessonIds: [],
  customLesson: null,
  language: 'es',
  dedication: null,
  wizardStep: 0,
  photoIds: [],
  characterMode: 'photo',
  avatar: null,
  memories: null,
  preview: null,
  regenerationsUsed: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, path), data);
  });
}

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('users', () => {
  it('un usuario crea su propio perfil', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users', ALICE), userProfile(ALICE)));
  });

  it('no puede crear el perfil de otro', async () => {
    await assertFails(setDoc(doc(alice(), 'users', BOB), userProfile(BOB)));
  });

  it('no puede asignarse un rol', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users', ALICE), { ...userProfile(ALICE), role: 'admin' }),
    );
  });

  it('no puede usar un email distinto al de su token', async () => {
    await assertFails(
      setDoc(doc(alice(), 'users', ALICE), { ...userProfile(ALICE), email: 'otro@x.com' }),
    );
  });

  it('puede editar su idioma pero no su rol', async () => {
    await seed(`users/${ALICE}`, {
      ...userProfile(ALICE),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await assertSucceeds(
      updateDoc(doc(alice(), 'users', ALICE), { locale: 'en', updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(alice(), 'users', ALICE), { role: 'superadmin', updatedAt: serverTimestamp() }),
    );
  });

  it('otro cliente no lo lee; un admin sí', async () => {
    await seed(`users/${ALICE}`, {
      ...userProfile(ALICE),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await assertFails(getDoc(doc(bob(), 'users', ALICE)));
    await assertSucceeds(getDoc(doc(admin(), 'users', ALICE)));
  });

  it('nadie borra perfiles desde el cliente', async () => {
    await seed(`users/${ALICE}`, {
      ...userProfile(ALICE),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await assertFails(deleteDoc(doc(alice(), 'users', ALICE)));
  });
});

describe('children', () => {
  it('crea un perfil válido propio', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'children', 'c1'), child(ALICE)));
  });

  it('rechaza edad fuera de rango y demasiados gustos', async () => {
    await assertFails(setDoc(doc(alice(), 'children', 'c1'), { ...child(ALICE), age: 30 }));
    await assertFails(
      setDoc(doc(alice(), 'children', 'c2'), { ...child(ALICE), likes: Array(11).fill('x') }),
    );
  });

  it('no crea perfiles a nombre de otro', async () => {
    await assertFails(setDoc(doc(alice(), 'children', 'c1'), child(BOB)));
  });

  it('otro cliente no lo lee ni lo lista', async () => {
    await seed('children/c1', { ...child(ALICE), createdAt: new Date(), updatedAt: new Date() });
    await assertFails(getDoc(doc(bob(), 'children', 'c1')));
    await assertFails(getDocs(collection(bob(), 'children')));
    await assertSucceeds(
      getDocs(query(collection(alice(), 'children'), where('ownerUid', '==', ALICE))),
    );
  });

  it('no puede transferir el perfil a otro dueño', async () => {
    await seed('children/c1', { ...child(ALICE), createdAt: new Date(), updatedAt: new Date() });
    await assertFails(
      updateDoc(doc(alice(), 'children', 'c1'), { ownerUid: BOB, updatedAt: serverTimestamp() }),
    );
  });

  it('el dueño lo borra', async () => {
    await seed('children/c1', { ...child(ALICE), createdAt: new Date(), updatedAt: new Date() });
    await assertSucceeds(deleteDoc(doc(alice(), 'children', 'c1')));
  });
});

describe('books', () => {
  it('crea un borrador propio', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'books', 'b1'), draftBook(ALICE)));
  });

  it('no crea libros que no sean borrador ni con preview o regeneraciones', async () => {
    await assertFails(
      setDoc(doc(alice(), 'books', 'b1'), { ...draftBook(ALICE), status: 'preview_ready' }),
    );
    await assertFails(
      setDoc(doc(alice(), 'books', 'b2'), { ...draftBook(ALICE), preview: { pages: [] } }),
    );
    await assertFails(
      setDoc(doc(alice(), 'books', 'b3'), { ...draftBook(ALICE), regenerationsUsed: 5 }),
    );
  });

  it('solo usa perfiles de chicos propios', async () => {
    await seed('children/bob-child', {
      ...child(BOB),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await seed('children/alice-child', {
      ...child(ALICE),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await assertFails(setDoc(doc(alice(), 'books', 'b1'), draftBook(ALICE, 'bob-child')));
    await assertSucceeds(setDoc(doc(alice(), 'books', 'b2'), draftBook(ALICE, 'alice-child')));
  });

  it('edita el borrador pero no el estado ni las regeneraciones', async () => {
    await seed('books/b1', { ...draftBook(ALICE), createdAt: new Date(), updatedAt: new Date() });
    const ref = doc(alice(), 'books', 'b1');
    await assertSucceeds(
      updateDoc(ref, { dedication: 'Para Martina', wizardStep: 2, updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(ref, { status: 'ordered', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { regenerationsUsed: 3, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { wizardStep: 99, updatedAt: serverTimestamp() }));
  });

  it('modo sin foto con rasgos válidos y recuerdos de hasta 150 caracteres', async () => {
    await seed('books/b1', { ...draftBook(ALICE), createdAt: new Date(), updatedAt: new Date() });
    const ref = doc(alice(), 'books', 'b1');
    const avatar = {
      skinTone: 'brown',
      hairColor: 'dark-brown',
      hairLength: 'medium',
      hairType: 'curly',
      eyeColor: 'hazel',
      glasses: false,
    };
    await assertSucceeds(
      updateDoc(ref, { characterMode: 'avatar', avatar, updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(ref, { characterMode: 'robot', updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(ref, { avatar: { ...avatar, skinTone: 'verde' }, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(ref, { avatar: { ...avatar, extra: 'x' }, updatedAt: serverTimestamp() }),
    );
    const memories = {
      moment: null,
      companion: 'Su abuela Rosa',
      nickname: 'Tini',
      favorite: null,
    };
    await assertSucceeds(updateDoc(ref, { memories, updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(ref, {
        memories: { ...memories, moment: 'x'.repeat(151) },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        memories: { ...memories, address: 'Calle 1' },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('los borradores anteriores (sin modo ni recuerdos) se siguen editando', async () => {
    const legacy: Record<string, unknown> = { ...draftBook(ALICE) };
    delete legacy.characterMode;
    delete legacy.avatar;
    delete legacy.memories;
    await seed('books/old', { ...legacy, createdAt: new Date(), updatedAt: new Date() });
    await assertSucceeds(
      updateDoc(doc(alice(), 'books', 'old'), { wizardStep: 3, updatedAt: serverTimestamp() }),
    );
  });

  it('elige hasta 2 enseñanzas (el mensaje propio cuenta como una) y mensajes de hasta 150 caracteres', async () => {
    await seed('books/b1', { ...draftBook(ALICE), createdAt: new Date(), updatedAt: new Date() });
    const ref = doc(alice(), 'books', 'b1');
    await assertSucceeds(
      updateDoc(ref, { lessonIds: ['compartir', 'amistad'], updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(ref, {
        lessonIds: ['compartir', 'amistad', 'valentia'],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        lessonIds: ['compartir', 'amistad'],
        customLesson: 'Y un mensaje más',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(ref, { lessonIds: ['compartir'], updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(ref, {
        customLesson: 'Que sepa que el abuelo lo quiere mucho',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, { customLesson: 'x'.repeat(151), updatedAt: serverTimestamp() }),
    );
  });

  it('no edita libros ya pedidos', async () => {
    await seed('books/b1', {
      ...draftBook(ALICE),
      status: 'ordered',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await assertFails(
      updateDoc(doc(alice(), 'books', 'b1'), { dedication: 'x', updatedAt: serverTimestamp() }),
    );
    await assertFails(deleteDoc(doc(alice(), 'books', 'b1')));
  });

  it('otro cliente no lo lee', async () => {
    await seed('books/b1', { ...draftBook(ALICE), createdAt: new Date(), updatedAt: new Date() });
    await assertFails(getDoc(doc(bob(), 'books', 'b1')));
  });
});

describe('orders', () => {
  const order = {
    ownerUid: ALICE,
    bookId: 'b1',
    status: 'paid',
    format: 'hardcover',
    country: 'MX',
    currency: 'MXN',
    amounts: {
      subtotalMinor: 79900,
      discountMinor: 0,
      shippingMinor: 9900,
      taxMinor: 0,
      totalMinor: 89800,
    },
  };

  beforeEach(async () => {
    await seed('orders/o1', order);
    await seed('orders/o1/steps/s1', { name: 'generate_story', status: 'running' });
  });

  it('el dueño lee su pedido y sus pasos; otro cliente no', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'orders', 'o1')));
    await assertSucceeds(getDoc(doc(alice(), 'orders/o1/steps/s1')));
    await assertFails(getDoc(doc(bob(), 'orders', 'o1')));
    await assertFails(getDoc(doc(bob(), 'orders/o1/steps/s1')));
  });

  it('un cliente no crea pedidos ni cambia estado o precio', async () => {
    await assertFails(setDoc(doc(alice(), 'orders', 'o2'), order));
    await assertFails(updateDoc(doc(alice(), 'orders', 'o1'), { status: 'delivered' }));
    await assertFails(updateDoc(doc(alice(), 'orders', 'o1'), { 'amounts.totalMinor': 1 }));
    await assertFails(deleteDoc(doc(alice(), 'orders', 'o1')));
  });

  it('ni un admin escribe pedidos desde el cliente (solo la API)', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'orders', 'o1')));
    await assertFails(updateDoc(doc(admin(), 'orders', 'o1'), { status: 'refunded' }));
  });
});

describe('photos y consents', () => {
  it('solo el servidor los escribe; el dueño los lee', async () => {
    await assertFails(setDoc(doc(alice(), 'photos', 'p1'), { ownerUid: ALICE }));
    await assertFails(setDoc(doc(alice(), 'consents', 'k1'), { ownerUid: ALICE }));
    await seed('photos/p1', { ownerUid: ALICE });
    await assertSucceeds(getDoc(doc(alice(), 'photos', 'p1')));
    await assertFails(getDoc(doc(bob(), 'photos', 'p1')));
  });
});

describe('catálogo y configuración', () => {
  beforeEach(async () => {
    await seed('stories/activa', { active: true });
    await seed('stories/inactiva', { active: false });
    await seed('lessons/compartir', { active: true });
    await seed('lessons/borrador', { active: false });
    await seed('prices/MX_hardcover', { active: true, amountMinor: 79900 });
    await seed('content/terms_es', { published: true });
    await seed('content/faq_es', { published: false });
    await seed('siteConfig/global', { mode: 'live' });
    await seed('coupons/BIENVENIDA', { active: true });
    await seed('aiConfig/global', { textProvider: 'mock' });
    await seed('auditLog/a1', { action: 'test' });
    await seed('aiUsage/u1', { kind: 'story', costUsdMicros: 10 });
    await seed('aiBudget/2026-10-26', { spentUsdMicros: 10 });
    await seed('previewQuota/alice_2026-10-26', { count: 1 });
  });

  it('cualquiera lee lo activo o publicado; lo inactivo solo un admin', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'stories', 'activa')));
    await assertFails(getDoc(doc(anon(), 'stories', 'inactiva')));
    await assertSucceeds(getDoc(doc(admin(), 'stories', 'inactiva')));
    await assertSucceeds(getDoc(doc(anon(), 'lessons', 'compartir')));
    await assertFails(getDoc(doc(anon(), 'lessons', 'borrador')));
    await assertFails(setDoc(doc(admin(), 'lessons', 'nueva'), { active: true }));
    await assertSucceeds(getDoc(doc(anon(), 'content', 'terms_es')));
    await assertFails(getDoc(doc(anon(), 'content', 'faq_es')));
    await assertSucceeds(getDoc(doc(anon(), 'siteConfig', 'global')));
  });

  it('un cliente no cambia precios ni el modo del sitio', async () => {
    await assertFails(updateDoc(doc(alice(), 'prices', 'MX_hardcover'), { amountMinor: 1 }));
    await assertFails(updateDoc(doc(alice(), 'siteConfig', 'global'), { mode: 'maintenance' }));
  });

  it('las escrituras de configuración pasan por la API, también para admins', async () => {
    await assertFails(updateDoc(doc(admin(), 'siteConfig', 'global'), { mode: 'maintenance' }));
    await assertFails(setDoc(doc(admin(), 'stories', 'nueva'), { active: true }));
  });

  it('cupones, configuración de IA y auditoría solo para admins', async () => {
    for (const path of ['coupons/BIENVENIDA', 'aiConfig/global', 'auditLog/a1']) {
      await assertFails(getDoc(doc(alice(), path)));
      await assertSucceeds(getDoc(doc(admin(), path)));
    }
    await assertFails(setDoc(doc(admin(), 'auditLog', 'a2'), { action: 'falso' }));
  });

  it('uso y gasto de IA: solo lectura para admins; las cuotas no las ve nadie', async () => {
    for (const path of ['aiUsage/u1', 'aiBudget/2026-10-26']) {
      await assertFails(getDoc(doc(alice(), path)));
      await assertSucceeds(getDoc(doc(admin(), path)));
      await assertFails(setDoc(doc(admin(), path), { spentUsdMicros: 0 }));
    }
    await assertFails(getDoc(doc(alice(), 'previewQuota', 'alice_2026-10-26')));
    await assertFails(getDoc(doc(admin(), 'previewQuota', 'alice_2026-10-26')));
    await assertFails(setDoc(doc(alice(), 'previewQuota', 'alice_2026-10-26'), { count: 0 }));
  });

  it('un superadmin tiene los mismos permisos de lectura que un admin', async () => {
    await assertSucceeds(getDoc(doc(db('root-1', { role: 'superadmin' }), 'aiConfig', 'global')));
  });

  it('un rol inventado se trata como customer', async () => {
    await assertFails(getDoc(doc(db('x', { role: 'root' }), 'aiConfig', 'global')));
  });
});
