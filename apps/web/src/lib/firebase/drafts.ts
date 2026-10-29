import {
  COLLECTIONS,
  DEFAULT_EDITORIAL_CONFIG,
  EMPTY_BIRTHDAY,
  type Book,
  type Channel,
  type Child,
  type Locale,
} from '@storynido/shared';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';

/** Campos de un borrador que edita el cliente (las reglas rechazan cualquier otro). */
export type BookEdits = Partial<
  Pick<
    Book,
    | 'childId'
    | 'storyId'
    | 'styleId'
    | 'lessonIds'
    | 'customLesson'
    | 'language'
    | 'dedication'
    | 'wizardStep'
    | 'wizardStepKey'
    | 'photoIds'
    | 'characterMode'
    | 'avatar'
    | 'memories'
    | 'event'
    | 'goal'
    | 'length'
    | 'textDensity'
    | 'readingLevel'
    | 'contentType'
  >
>;

export type ChildFields = Pick<
  Child,
  'name' | 'age' | 'pronouns' | 'likes' | 'petName' | 'bestFriendName'
> & {
  /** Profesionales: identifica el proyecto sin usar el nombre real (el cuento usa `name`). */
  alias?: string | null;
};

export interface DraftSummary {
  id: string;
  childName: string | null;
  updatedAt: Date | null;
  wizardStep: number;
  channel: Channel;
}

/** Borrador recién creado al que nunca se le cargó nada (se reutiliza en vez de listarlo). */
export const isEmptyDraft = (draft: DraftSummary) => !draft.childName && draft.wizardStep === 0;

type Timestampish = { toDate(): Date } | null | undefined;

const asDate = (value: Timestampish) => value?.toDate() ?? null;

export async function createDraft(
  db: Firestore,
  uid: string,
  preset: {
    language: Locale;
    storyId: string | null;
    lessonId: string | null;
    channel: Channel;
    /** "Repetir configuración" (Profesionales): estilo y opciones editoriales, sin datos del niño. */
    settings?: ProjectSettings;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.books), {
    ownerUid: uid,
    status: 'draft',
    childId: null,
    storyId: preset.storyId,
    styleId: null,
    lessonIds: preset.lessonId ? [preset.lessonId] : [],
    customLesson: null,
    language: preset.language,
    dedication: null,
    wizardStep: 0,
    photoIds: [],
    // Profesionales: arranca sin foto (el avatar evita subir fotos de chicos ajenos).
    characterMode: preset.channel === 'professionals' ? 'avatar' : 'photo',
    avatar: null,
    memories: null,
    // Eventos: el cumpleaños se completa en el paso del protagonista.
    event: preset.channel === 'events' ? EMPTY_BIRTHDAY : null,
    // Profesionales: objetivo general (uno de los temas de la colección), opcional.
    goal: null,
    // Opciones editoriales: se ajustan en el paso de la aventura (sugeridas según la edad).
    // Eventos arranca como mini cuento muy visual (el librito para cada invitado).
    ...DEFAULT_EDITORIAL_CONFIG.defaults,
    ...(preset.channel === 'events' ? { length: 'mini', textDensity: 'visual' } : {}),
    ...preset.settings,
    channel: preset.channel,
    preview: null,
    regenerationsUsed: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Lo que copia "Repetir configuración": historia aparte, nada del niño ni de sus fotos. */
export type ProjectSettings = Pick<
  Book,
  'styleId' | 'length' | 'textDensity' | 'readingLevel' | 'contentType'
>;

export interface ProjectBook {
  id: string;
  status: Book['status'];
  storyId: string | null;
  goal: string | null;
  settings: ProjectSettings;
  updatedAt: Date | null;
}

export interface Project {
  childId: string;
  /** Alias del proyecto; si no tiene, el nombre del cuento. */
  label: string;
  books: ProjectBook[];
}

/** Profesionales: libros de la línea agrupados por niño (cada niño es un proyecto). */
export async function listProjects(db: Firestore, uid: string): Promise<Project[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.books),
      where('ownerUid', '==', uid),
      orderBy('updatedAt', 'desc'),
      limit(100),
    ),
  );
  const byChild = new Map<string, ProjectBook[]>();
  for (const book of snapshot.docs) {
    const childId = book.get('childId') as string | null;
    if (book.get('channel') !== 'professionals' || !childId) continue;
    const data = book.data();
    byChild.set(childId, [
      ...(byChild.get(childId) ?? []),
      {
        id: book.id,
        status: data.status as Book['status'],
        storyId: (data.storyId as string | null | undefined) ?? null,
        goal: (data.goal as string | null | undefined) ?? null,
        settings: {
          styleId: (data.styleId as string | null | undefined) ?? null,
          length: (data.length as Book['length'] | undefined) ?? null,
          textDensity: (data.textDensity as Book['textDensity'] | undefined) ?? 'balanced',
          readingLevel: (data.readingLevel as Book['readingLevel'] | undefined) ?? 'developing',
          contentType: (data.contentType as Book['contentType'] | undefined) ?? 'story',
        },
        updatedAt: asDate(data.updatedAt as Timestampish),
      },
    ]);
  }
  return Promise.all(
    [...byChild].map(async ([childId, books]) => {
      const child = await getDoc(doc(db, COLLECTIONS.children, childId));
      const alias = child.get('alias') as string | null | undefined;
      return {
        childId,
        label: alias?.trim() ? alias : ((child.get('name') as string | undefined) ?? '—'),
        books,
      };
    }),
  );
}

export async function listDrafts(db: Firestore, uid: string): Promise<DraftSummary[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.books),
      where('ownerUid', '==', uid),
      // Libros sin comprar: borradores y los que ya tienen su muestra.
      where('status', 'in', ['draft', 'preview_generating', 'preview_ready']),
      orderBy('updatedAt', 'desc'),
      limit(10),
    ),
  );
  return Promise.all(
    snapshot.docs.map(async (book) => {
      const childId = book.get('childId') as string | null;
      // Un perfil borrado (o ilegible) no puede trabar la lista: el borrador queda sin nombre.
      const child = childId
        ? await getDoc(doc(db, COLLECTIONS.children, childId)).catch(() => null)
        : null;
      return {
        id: book.id,
        childName: (child?.get('name') as string | undefined) ?? null,
        updatedAt: asDate(book.get('updatedAt') as Timestampish),
        wizardStep: book.get('wizardStep') as number,
        channel: (book.get('channel') as Channel | undefined) ?? 'families',
      };
    }),
  );
}

export function subscribeBook(
  db: Firestore,
  bookId: string,
  onChange: (book: (Book & { id: string }) | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTIONS.books, bookId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const data = snapshot.data({ serverTimestamps: 'estimate' });
      onChange({
        ...(data as Book),
        // Borradores creados antes de permitir varias enseñanzas no tienen lessonIds.
        lessonIds: Array.isArray(data.lessonIds) ? (data.lessonIds as string[]) : [],
        // Borradores anteriores al modo sin foto y a los recuerdos.
        characterMode: data.characterMode === 'avatar' ? 'avatar' : 'photo',
        avatar: (data.avatar as Book['avatar'] | undefined) ?? null,
        memories: (data.memories as Book['memories'] | undefined) ?? null,
        event: (data.event as Book['event'] | undefined) ?? null,
        goal: (data.goal as string | null | undefined) ?? null,
        // Borradores anteriores a las opciones editoriales (extensión null = la de su historia).
        length: (data.length as Book['length'] | undefined) ?? null,
        textDensity: (data.textDensity as Book['textDensity'] | undefined) ?? 'balanced',
        readingLevel: (data.readingLevel as Book['readingLevel'] | undefined) ?? 'developing',
        contentType: (data.contentType as Book['contentType'] | undefined) ?? 'story',
        channel: (data.channel as Book['channel'] | undefined) ?? 'families',
        id: snapshot.id,
        createdAt: asDate(data.createdAt as Timestampish) ?? new Date(),
        updatedAt: asDate(data.updatedAt as Timestampish) ?? new Date(),
      });
    },
    onError,
  );
}

export function subscribeChild(
  db: Firestore,
  childId: string,
  onChange: (child: ChildFields | null) => void,
): () => void {
  return onSnapshot(doc(db, COLLECTIONS.children, childId), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as ChildFields) : null);
  });
}

export async function updateBook(db: Firestore, bookId: string, edits: BookEdits): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.books, bookId), { ...edits, updatedAt: serverTimestamp() });
}

/** Crea o actualiza el perfil del protagonista y lo vincula al borrador. */
export async function saveChild(
  db: Firestore,
  uid: string,
  bookId: string,
  childId: string | null,
  fields: ChildFields,
): Promise<string> {
  if (childId) {
    await updateDoc(doc(db, COLLECTIONS.children, childId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
    return childId;
  }
  const ref = await addDoc(collection(db, COLLECTIONS.children), {
    ownerUid: uid,
    ...fields,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateBook(db, bookId, { childId: ref.id });
  return ref.id;
}
