import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  type User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { paths, productInputSchema, productSearchKeywords } from '@hiper/shared';

/**
 * Fluxo real contra os emuladores (Auth, Firestore e Functions): cadastro da
 * empresa, claims, equipe e catálogo público. Roda com `pnpm test:integration`.
 */

const PROJECT_ID = 'demo-hiper-delivery';
const REGION = 'southamerica-east1';
const run = Math.random().toString(36).slice(2, 8);

interface Session {
  app: FirebaseApp;
  user: User;
  db: Firestore;
  call: <T = unknown>(name: string, data: unknown) => Promise<T>;
  claims: () => Promise<Record<string, unknown>>;
}

const apps: FirebaseApp[] = [];

async function signUp(name: string): Promise<Session> {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, `${name}-${run}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const { user } = await createUserWithEmailAndPassword(
    auth,
    `${name}-${run}@teste.com`,
    'senha-123',
  );
  return {
    app,
    user,
    db,
    call: async (fn, data) => (await httpsCallable(functions, fn)(data)).data as never,
    claims: async () => (await user.getIdTokenResult(true)).claims,
  };
}

async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const v = await read();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Condição não atingida a tempo');
}

async function expectCallError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code: `functions/${code}` });
}

afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)));
});

describe('cadastro da empresa e equipe', () => {
  let owner: Session;
  let tenantId: string;
  const slug = `lanche-${run}`;

  it('o lojista cria a empresa e vira dono pelos claims', async () => {
    owner = await signUp('dono');
    const result = await owner.call<{ tenantId: string }>('createTenant', {
      tradeName: 'Lanche Bom',
      slug,
      segment: 'restaurant',
    });
    tenantId = result.tenantId;
    expect(await owner.claims()).toMatchObject({ tid: tenantId, role: 'owner' });

    const tenant = await getDoc(doc(owner.db, paths.tenant(tenantId)));
    expect(tenant.data()).toMatchObject({
      status: 'trial',
      plan: 'essential',
      slug,
      ownerUid: owner.user.uid,
    });
    const store = await getDoc(doc(owner.db, paths.publicStore(slug)));
    expect(store.data()).toMatchObject({ tenantId, open: true });
  });

  it('não cria segunda empresa para o mesmo usuário nem repete endereço', async () => {
    await expectCallError(
      owner.call('createTenant', { tradeName: 'Outra', slug: `outra-${run}`, segment: 'bakery' }),
      'failed-precondition',
    );
    const other = await signUp('outro');
    await expectCallError(
      other.call('createTenant', { tradeName: 'Copia', slug, segment: 'bakery' }),
      'already-exists',
    );
    await expectCallError(
      other.call('createTenant', { tradeName: 'X', slug: 'admin', segment: 'bakery' }),
      'invalid-argument',
    );
  });

  it('produto vira item do catálogo público sem dados internos, e sai quando oculto', async () => {
    const input = productInputSchema.parse({
      internalCode: 'XB-01',
      gtins: ['7891000100103'],
      name: 'X-Burger',
      pricing: { salePriceCents: 2590 },
      fiscal: { ncm: '21069090' },
    });
    const ref = doc(owner.db, paths.product(tenantId, 'xburger'));
    await setDoc(ref, {
      ...input,
      searchKeywords: [],
      createdAt: serverTimestamp(),
      createdBy: owner.user.uid,
      updatedAt: serverTimestamp(),
      updatedBy: owner.user.uid,
    });

    const catalogRef = doc(owner.db, paths.catalogItem(tenantId, 'xburger'));
    const item = await eventually(
      () => getDoc(catalogRef),
      (s) => s.exists(),
    );
    expect(item.data()).toMatchObject({ name: 'X-Burger', salePriceCents: 2590, available: true });
    expect(item.data()).not.toHaveProperty('internalCode');
    expect(item.data()).not.toHaveProperty('fiscal');
    // Palavras-chave recalculadas no servidor, mesmo o painel tendo mandado vazio.
    expect(item.data()?.searchKeywords).toEqual(productSearchKeywords(input));

    await updateDoc(ref, {
      'online.visible': false,
      updatedBy: owner.user.uid,
      updatedAt: serverTimestamp(),
    });
    await eventually(
      () => getDoc(catalogRef),
      (s) => !s.exists(),
    );
    await deleteDoc(ref);
  });

  it('dono adiciona atendente, promove a gerente e remove', async () => {
    const staff = await signUp('atendente');
    await owner.call('addMember', { email: staff.user.email, role: 'attendant' });
    expect(await staff.claims()).toMatchObject({ tid: tenantId, role: 'attendant' });
    await expect(getDoc(doc(staff.db, paths.tenant(tenantId)))).resolves.toBeTruthy();

    // Gerente não pode tirar o dono.
    await owner.call('setMemberRole', { uid: staff.user.uid, role: 'manager' });
    expect(await staff.claims()).toMatchObject({ role: 'manager' });
    await expectCallError(
      staff.call('setMemberRole', { uid: owner.user.uid, role: null }),
      'permission-denied',
    );
    await expectCallError(
      staff.call('addMember', { email: owner.user.email, role: 'owner' }),
      'permission-denied',
    );

    await owner.call('setMemberRole', { uid: staff.user.uid, role: null });
    const after = await getDoc(doc(owner.db, paths.member(tenantId, staff.user.uid)));
    expect(after.exists()).toBe(false);
  });

  it('não adiciona quem já está em outra empresa nem e-mail sem conta', async () => {
    const otherOwner = await signUp('dono2');
    await otherOwner.call('createTenant', {
      tradeName: 'Mercado',
      slug: `mercado-${run}`,
      segment: 'grocery',
    });
    await expectCallError(
      owner.call('addMember', { email: otherOwner.user.email, role: 'attendant' }),
      'failed-precondition',
    );
    await expectCallError(
      owner.call('addMember', { email: `ninguem-${run}@teste.com`, role: 'attendant' }),
      'not-found',
    );
  });

  it('o único dono não deixa a empresa sem dono', async () => {
    await expectCallError(
      owner.call('setMemberRole', { uid: owner.user.uid, role: 'manager' }),
      'permission-denied',
    );
  });

  it('nome novo da loja chega ao endereço público', async () => {
    await updateDoc(doc(owner.db, paths.tenant(tenantId)), {
      tradeName: 'Lanche Muito Bom',
      updatedBy: owner.user.uid,
      updatedAt: serverTimestamp(),
    });
    await eventually(
      () => getDoc(doc(owner.db, paths.publicStore(slug))),
      (s) => s.data()?.tradeName === 'Lanche Muito Bom',
    );
  });
});
