import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import {
  orderPaths,
  paths,
  searchTerm,
  type CreateOrderInput,
  type SavedAddressInput,
  type UserProfileInput,
} from '@hiper/shared';
import { env } from '@/lib/env';
import { firebase } from '@/lib/firebase/app';
import {
  DataError,
  type AddressEntry,
  type CatalogEntry,
  type CategoryEntry,
  type CreateOrderResult,
  type DataSource,
  type OrderEntry,
  type Page,
  type Storefront,
} from './types';

const STORES_PAGE = 20;
const CATALOG_PAGE = 24;
const ORDERS_PAGE = 15;

function millis(value: unknown): number {
  const ts = value as { toMillis?: () => number } | null | undefined;
  return ts?.toMillis?.() ?? Date.now();
}

function toOrder(snap: DocumentSnapshot<DocumentData>): OrderEntry | null {
  const data = snap.data();
  if (!data) return null;
  const { createdAt, updatedAt: _updatedAt, ...rest } = data;
  return {
    ...(rest as Omit<OrderEntry, 'id' | 'createdAtMs'>),
    id: snap.id,
    createdAtMs: millis(createdAt),
  };
}

function page<T>(
  docs: QueryDocumentSnapshot<DocumentData>[],
  size: number,
  map: (d: QueryDocumentSnapshot<DocumentData>) => T,
): Page<T> {
  return { items: docs.map(map), next: docs.length === size ? docs[docs.length - 1] : null };
}

/** Converte o erro do Firebase num DataError com mensagem em português. */
function wrap(error: unknown): DataError {
  const e = error as { code?: string; message?: string; details?: unknown };
  const code = e.code ?? 'unknown';
  const friendly: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/too-many-requests': 'Muitas tentativas. Tente de novo em alguns minutos.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/requires-recent-login': 'Por segurança, entre de novo antes de excluir a conta.',
    unavailable: 'Sem conexão. Confira sua internet.',
  };
  const message =
    friendly[code] ??
    (code.startsWith('functions/') ? e.message : null) ??
    'Algo deu errado. Tente de novo.';
  return new DataError(message ?? 'Algo deu errado.', code, e.details);
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw wrap(error);
  }
}

export function createFirebaseSource(): DataSource {
  const { auth, db, functions } = firebase();

  return {
    kind: 'firebase',

    onAuthChanged(cb) {
      return onAuthStateChanged(auth, (u) =>
        cb(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null),
      );
    },
    signIn: (email, password) =>
      guard(async () => void (await signInWithEmailAndPassword(auth, email, password))),
    signUp: (name, email, password) =>
      guard(async () => {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, paths.user(user.uid)), {
          displayName: name,
          phone: null,
          marketingOptIn: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }),
    signInWithGoogle: () =>
      guard(async () => {
        if (Platform.OS !== 'web') {
          throw new DataError(
            'Login com Google no celular chega com as credenciais do projeto.',
            'unimplemented',
          );
        }
        await signInWithPopup(auth, new GoogleAuthProvider());
      }),
    sendPasswordReset: (email) => guard(() => sendPasswordResetEmail(auth, email)),
    signOut: () => signOut(auth),
    deleteAccount: () =>
      guard(async () => {
        await httpsCallable(functions, 'deleteAccount')({});
        await signOut(auth);
      }),
    getProfile: (uid) =>
      guard(async () => {
        const snap = await getDoc(doc(db, paths.user(uid)));
        return (snap.data() as UserProfileInput | undefined) ?? null;
      }),
    saveProfile: (uid, profile) =>
      guard(async () => {
        const ref = doc(db, paths.user(uid));
        const existing = await getDoc(ref);
        await setDoc(ref, {
          ...profile,
          createdAt: existing.exists() ? existing.get('createdAt') : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (auth.currentUser)
          await updateProfile(auth.currentUser, { displayName: profile.displayName });
      }),

    listStores: (after) =>
      guard(async () => {
        const constraints: QueryConstraint[] = [
          where('open', '==', true),
          orderBy('tradeName'),
          limit(STORES_PAGE),
        ];
        if (after) constraints.splice(2, 0, startAfter(after));
        const snap = await getDocs(query(collection(db, 'publicStores'), ...constraints));
        return page(snap.docs, STORES_PAGE, (d) => ({ ...(d.data() as Storefront), slug: d.id }));
      }),
    getStore: (slug) =>
      guard(async () => {
        const snap = await getDoc(doc(db, paths.publicStore(slug)));
        return snap.exists() ? { ...(snap.data() as Storefront), slug } : null;
      }),
    listCategories: (tenantId) =>
      guard(async () => {
        const snap = await getDocs(
          query(
            collection(db, orderPaths.publicCategories(tenantId)),
            orderBy('displayOrder'),
            limit(100),
          ),
        );
        return snap.docs.map((d) => ({ ...(d.data() as Omit<CategoryEntry, 'id'>), id: d.id }));
      }),
    listCatalog: (tenantId, q) =>
      guard(async () => {
        const size = q.pageSize ?? CATALOG_PAGE;
        const constraints: QueryConstraint[] = [];
        const term = q.search ? searchTerm(q.search) : null;
        if (term) constraints.push(where('searchKeywords', 'array-contains', term));
        else if (q.categoryId) constraints.push(where('categoryId', '==', q.categoryId));
        constraints.push(orderBy('displayOrder'));
        if (q.after) constraints.push(startAfter(q.after));
        constraints.push(limit(size));
        const snap = await getDocs(query(collection(db, paths.catalog(tenantId)), ...constraints));
        return page(snap.docs, size, (d) => ({
          ...(d.data() as Omit<CatalogEntry, 'id'>),
          id: d.id,
        }));
      }),
    getCatalogItems: (tenantId, ids) =>
      guard(async () => {
        const result = new Map<string, CatalogEntry>();
        // O operador "in" aceita até 30 valores por consulta.
        for (let i = 0; i < ids.length; i += 30) {
          const chunk = ids.slice(i, i + 30);
          const snap = await getDocs(
            query(collection(db, paths.catalog(tenantId)), where(documentId(), 'in', chunk)),
          );
          for (const d of snap.docs)
            result.set(d.id, { ...(d.data() as Omit<CatalogEntry, 'id'>), id: d.id });
        }
        return result;
      }),
    photoUrl(path) {
      if (/^https?:\/\//.test(path)) return path;
      const bucket = env.firebase.storageBucket;
      const base = env.useEmulators
        ? `http://${env.emulatorHost}:9199/v0/b/${bucket}/o/`
        : `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`;
      return `${base}${encodeURIComponent(path)}?alt=media`;
    },

    createOrder: (input: CreateOrderInput) =>
      guard(
        async () =>
          (await httpsCallable(functions, 'createOrder')(input)).data as CreateOrderResult,
      ),
    listMyOrders: (uid, after) =>
      guard(async () => {
        const constraints: QueryConstraint[] = [
          where('customerUid', '==', uid),
          orderBy('createdAt', 'desc'),
        ];
        if (after) constraints.push(startAfter(after));
        constraints.push(limit(ORDERS_PAGE));
        const snap = await getDocs(query(collectionGroup(db, 'orders'), ...constraints));
        return page(snap.docs, ORDERS_PAGE, (d) => toOrder(d)!);
      }),
    getOrder: (tenantId, orderId) =>
      guard(async () => toOrder(await getDoc(doc(db, orderPaths.order(tenantId, orderId))))),
    watchOrder(tenantId, orderId, cb) {
      return onSnapshot(
        doc(db, orderPaths.order(tenantId, orderId)),
        (snap) => cb(toOrder(snap)),
        () => cb(null),
      );
    },
    watchCourierPosition(tenantId, orderId, cb) {
      return onSnapshot(
        doc(db, orderPaths.courierPosition(tenantId, orderId)),
        (snap) => {
          const d = snap.data();
          cb(
            d
              ? {
                  lat: d.lat,
                  lng: d.lng,
                  heading: d.heading ?? null,
                  updatedAtMs: millis(d.updatedAt),
                }
              : null,
          );
        },
        () => cb(null),
      );
    },

    listAddresses: (uid) =>
      guard(async () => {
        const snap = await getDocs(query(collection(db, orderPaths.addresses(uid)), limit(20)));
        return snap.docs.map((d) => {
          const { createdAt: _c, updatedAt: _u, ...rest } = d.data();
          return { ...(rest as SavedAddressInput), id: d.id } satisfies AddressEntry;
        });
      }),
    saveAddress: (uid, address, id) =>
      guard(async () => {
        const ref = id
          ? doc(db, orderPaths.address(uid, id))
          : doc(collection(db, orderPaths.addresses(uid)));
        const existing = id ? await getDoc(ref) : null;
        await setDoc(ref, {
          ...address,
          createdAt: existing?.exists() ? existing.get('createdAt') : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return ref.id;
      }),
    deleteAddress: (uid, id) => guard(() => deleteDoc(doc(db, orderPaths.address(uid, id)))),
  };
}
