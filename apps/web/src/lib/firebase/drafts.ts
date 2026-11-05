import {
  COLLECTIONS,
  DEFAULT_EDITORIAL_CONFIG,
  EMPTY_BIRTHDAY,
  type Avatar,
  type Book,
  type Channel,
  type Child,
  type EventType,
  type Locale,
} from '@storynido/shared';
import {
  addDoc,
  arrayRemove,
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
    | 'useDrawing'
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
  /** `preview_generating`: se está dibujando la muestra; `preview_ready`: ya tiene muestra. */
  status: 'draft' | 'preview_generating' | 'preview_ready';
  /** Historia elegida (para mostrar su portada). */
  storyId: string | null;
  /** Se está dibujando ahora (una generación de más de 10 minutos se da por colgada). */
  generating: boolean;
  /** Celebraciones: temática de la fiesta. */
  eventTheme: string | null;
}

const STALE_GENERATION_MS = 10 * 60 * 1000;
const isGeneratingNow = (status: string, startedAt: Date | null) =>
  status === 'preview_generating' &&
  startedAt !== null &&
  Date.now() - startedAt.getTime() < STALE_GENERATION_MS;

/** Borrador recién creado al que nunca se le cargó nada (se reutiliza en vez de listarlo). */
export const isEmptyDraft = (draft: DraftSummary) => !draft.childName && draft.wizardStep === 0;

type Timestampish = { toDate(): Date } | null | undefined;

const asDate = (value: Timestampish) => value?.toDate() ?? null;

/** Lo que define un borrador nuevo: idioma, línea y lo que venga elegido (historia, enseñanza). */
export interface DraftPreset {
  language: Locale;
  storyId: string | null;
  lessonId: string | null;
  channel: Channel;
  /** "Repetir configuración" (Profesionales): estilo y opciones editoriales, sin datos del niño. */
  settings?: ProjectSettings;
  /** Celebraciones: temática de la fiesta elegida en la landing. */
  eventTheme?: string | null;
  /** Celebraciones: la ocasión elegida en la landing (sin ella, cumpleaños). */
  eventType?: EventType | null;
  /** Tipo de contenido pedido desde un destacado (por ejemplo, «Para colorear» en Brasil). */
  contentType?: Book['contentType'] | null;
}

/** Campos de un borrador nuevo (sin las fechas, que pone quien lo guarda). */
function draftFields(uid: string, preset: DraftPreset) {
  return {
    ownerUid: uid,
    status: 'draft' as const,
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
    characterMode: preset.channel === 'professionals' ? ('avatar' as const) : ('photo' as const),
    avatar: null,
    memories: null,
    // Eventos: la ocasión se completa en el paso del protagonista.
    event:
      preset.channel === 'events'
        ? {
            ...EMPTY_BIRTHDAY,
            ...(preset.eventType ? { type: preset.eventType } : {}),
            theme: preset.eventTheme ?? null,
          }
        : null,
    // Profesionales: objetivo general (uno de los temas de la colección), opcional.
    goal: null,
    // Opciones editoriales: se ajustan en el paso de la aventura (sugeridas según la edad).
    // Eventos arranca como mini cuento muy visual (el librito para cada invitado).
    ...DEFAULT_EDITORIAL_CONFIG.defaults,
    ...(preset.channel === 'events'
      ? { length: 'mini' as const, textDensity: 'visual' as const }
      : {}),
    ...preset.settings,
    ...(preset.contentType ? { contentType: preset.contentType } : {}),
    channel: preset.channel,
    preview: null,
    regenerationsUsed: 0,
  };
}

export async function createDraft(
  db: Firestore,
  uid: string,
  preset: DraftPreset,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.books), {
    ...draftFields(uid, preset),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Borrador en memoria (id vacío) para mostrar el creador sin escribir nada: el documento se
 * crea recién en el primer guardado real (DECISIONS 114).
 */
export function unsavedDraft(uid: string, preset: DraftPreset): Book & { id: string } {
  const now = new Date();
  return { ...draftFields(uid, preset), id: '', createdAt: now, updatedAt: now };
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
      limit(50),
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
        status: book.get('status') as DraftSummary['status'],
        storyId: (book.get('storyId') as string | null | undefined) ?? null,
        generating: isGeneratingNow(
          book.get('status') as string,
          asDate(book.get('previewStartedAt') as Timestampish),
        ),
        eventTheme: (book.get('event.theme') as string | null | undefined) ?? null,
      };
    }),
  );
}

/** Estado actual de un borrador (para seguir en vivo una muestra que se está dibujando). */
export async function readDraftState(
  db: Firestore,
  id: string,
): Promise<Pick<DraftSummary, 'status' | 'generating'> | null> {
  const book = await getDoc(doc(db, COLLECTIONS.books, id));
  if (!book.exists()) return null;
  return {
    status: book.get('status') as DraftSummary['status'],
    generating: isGeneratingNow(
      book.get('status') as string,
      asDate(book.get('previewStartedAt') as Timestampish),
    ),
  };
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

/** Saca fotos de este borrador sin borrarlas (las de un personaje reutilizado son de otro cuento). */
export async function unlinkPhotos(
  db: Firestore,
  bookId: string,
  photoIds: string[],
): Promise<void> {
  if (photoIds.length === 0) return;
  await updateDoc(doc(db, COLLECTIONS.books, bookId), {
    photoIds: arrayRemove(...photoIds),
    updatedAt: serverTimestamp(),
  });
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

/** Un protagonista ya creado, para reutilizarlo en otro cuento (nuevo flujo, PR 6). */
export interface SavedCharacter {
  id: string;
  fields: ChildFields;
  /**
   * Cómo se lo dibuja: con su dibujo aprobado en el perfil (si tiene), sus fotos vigentes (del
   * último cuento o subidas desde su perfil) o sus rasgos.
   */
  look: Pick<Book, 'characterMode' | 'avatar' | 'photoIds' | 'useDrawing'> | null;
}

/** Los rasgos del dibujo aprobado como rasgos del modo sin foto (si están todos). */
function avatarFrom(traits: Partial<Avatar> | null | undefined): Avatar | null {
  if (!traits) return null;
  const { skinTone, hairColor, hairLength, hairType, eyeColor, glasses } = traits;
  return skinTone && hairColor && hairLength && hairType && eyeColor
    ? { skinTone, hairColor, hairLength, hairType, eyeColor, glasses: glasses ?? false }
    : null;
}

/** Protagonistas del usuario con su aspecto más reciente. */
export async function listSavedCharacters(db: Firestore, uid: string): Promise<SavedCharacter[]> {
  const [children, books] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.children), where('ownerUid', '==', uid))),
    getDocs(query(collection(db, COLLECTIONS.books), where('ownerUid', '==', uid))),
  ]);
  const latest = new Map<string, Book>();
  for (const snapshot of books.docs) {
    const book = snapshot.data() as Book;
    if (!book.childId) continue;
    const current = latest.get(book.childId);
    const time = (value: unknown) =>
      value && typeof value === 'object' && 'toMillis' in value
        ? (value as { toMillis: () => number }).toMillis()
        : 0;
    if (!current || time(book.updatedAt) > time(current.updatedAt)) latest.set(book.childId, book);
  }
  // Perfiles repetidos (mismo nombre y edad, de borradores que no reutilizaron al personaje): se
  // muestra uno solo, el más completo: con dibujo aprobado, después con rasgos y, si no, el que
  // tiene un cuento. Así un duplicado vacío nunca tapa al personaje con su dibujo.
  const seen = new Map<string, (typeof children.docs)[number]>();
  const rank = (child: (typeof children.docs)[number]) =>
    (child.get('drawing') ? 4 : 0) + (child.get('avatar') ? 2 : 0) + (latest.get(child.id) ? 1 : 0);
  for (const child of children.docs) {
    const key = `${String(child.get('name')).trim().toLowerCase()}|${String(child.get('age'))}`;
    const kept = seen.get(key);
    if (!kept || rank(child) > rank(kept)) seen.set(key, child);
  }
  return Promise.all(
    [...seen.values()].map(async (child) => {
      const book = latest.get(child.id);
      const stillValid = async (ids: string[]) =>
        (
          await Promise.all(
            ids.map(async (id) => {
              const photo = await getDoc(doc(db, COLLECTIONS.photos, id)).catch(() => null);
              return photo?.get('status') === 'valid' ? id : null;
            }),
          )
        ).filter((id): id is string => id !== null);
      // Las fotos se borran a los 30 días: solo se reutilizan las que siguen válidas. Primero las
      // de su último cuento; si no hay, las que se subieron desde su perfil (sin cuento).
      let photoIds = book?.photoIds.length ? await stillValid(book.photoIds) : [];
      if (photoIds.length === 0) {
        const fromProfile = await getDocs(
          query(
            collection(db, COLLECTIONS.photos),
            where('ownerUid', '==', uid),
            where('childId', '==', child.id),
          ),
        ).catch(() => null);
        photoIds = (fromProfile?.docs ?? [])
          .filter((photo) => photo.get('status') === 'valid')
          .map((photo) => photo.id)
          .slice(0, 3);
      }
      const drawing = child.get('drawing') as
        { imagePath?: string; traits?: Partial<Avatar> | null } | undefined;
      const hasDrawing = typeof drawing?.imagePath === 'string';
      const avatar =
        (book?.characterMode === 'avatar' ? book.avatar : null) ??
        (child.get('avatar') as Avatar | null | undefined) ??
        null;
      const base: SavedCharacter['look'] =
        book?.characterMode === 'avatar' && avatar
          ? { characterMode: 'avatar', avatar, photoIds: [] }
          : photoIds.length > 0
            ? { characterMode: 'photo', avatar: null, photoIds }
            : avatar
              ? { characterMode: 'avatar', avatar, photoIds: [] }
              : hasDrawing && avatarFrom(drawing.traits)
                ? { characterMode: 'avatar', avatar: avatarFrom(drawing.traits), photoIds: [] }
                : null;
      // Con dibujo aprobado, el cuento usa ese dibujo como lámina (sin generar otra).
      const look: SavedCharacter['look'] =
        base && hasDrawing ? { ...base, useDrawing: true } : base;
      return {
        id: child.id,
        fields: {
          name: child.get('name') as string,
          age: child.get('age') as number,
          pronouns: (child.get('pronouns') as ChildFields['pronouns'] | undefined) ?? null,
          likes: (child.get('likes') as string[] | undefined) ?? [],
          petName: (child.get('petName') as string | null | undefined) ?? null,
          bestFriendName: (child.get('bestFriendName') as string | null | undefined) ?? null,
          alias: (child.get('alias') as string | null | undefined) ?? null,
        },
        look,
      };
    }),
  );
}
