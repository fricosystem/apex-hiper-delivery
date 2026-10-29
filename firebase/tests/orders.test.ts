import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { orderPaths, TENANT_ROLES } from '@hiper/shared';
import { A, as, B, createEnv, seed, staffOf } from './setup';

/**
 * Pedidos, posição do entregador, categorias públicas e endereços do cliente.
 * O cliente só vê os próprios pedidos; outra empresa nunca vê pedido da A.
 */

let env: RulesTestEnvironment;

const ANA = 'cliente-ana';
const BRUNO = 'cliente-bruno';

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const at = Timestamp.fromMillis(Date.now() - 60_000);
    await setDoc(doc(db, orderPaths.order(A, 'o1')), {
      tenantId: A,
      customerUid: ANA,
      status: 'dispatched',
      totalCents: 3000,
      createdAt: at,
    });
    await setDoc(doc(db, orderPaths.order(B, 'o2')), {
      tenantId: B,
      customerUid: BRUNO,
      status: 'pending',
      totalCents: 1500,
      createdAt: at,
    });
    await setDoc(doc(db, orderPaths.courierPosition(A, 'o1')), {
      customerUid: ANA,
      lat: -23.55,
      lng: -46.63,
      heading: null,
      updatedAt: at,
    });
    await setDoc(doc(db, orderPaths.publicCategory(A, 'lanches')), {
      name: 'Lanches',
      parentId: null,
      displayOrder: 0,
    });
  });
});

const address = (over: Record<string, unknown> = {}) => ({
  label: 'Casa',
  cep: '01310100',
  street: 'Avenida Paulista',
  number: '1000',
  complement: null,
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  location: { lat: -23.56, lng: -46.65 },
  reference: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

describe('pedidos', () => {
  it('cliente lê o próprio pedido e não o de outra pessoa', async () => {
    const db = as(env, ANA).firestore();
    await assertSucceeds(getDoc(doc(db, orderPaths.order(A, 'o1'))));
    await assertFails(getDoc(doc(db, orderPaths.order(B, 'o2'))));
  });

  it('histórico do cliente em todas as lojas só com filtro pelo próprio uid', async () => {
    const db = as(env, ANA).firestore();
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(db, 'orders'),
          where('customerUid', '==', ANA),
          orderBy('createdAt', 'desc'),
          limit(20),
        ),
      ),
    );
    await assertFails(getDocs(query(collectionGroup(db, 'orders'), limit(20))));
    await assertFails(
      getDocs(query(collectionGroup(db, 'orders'), where('customerUid', '==', BRUNO))),
    );
  });

  it('cliente não cria, altera nem apaga pedido (só a Function createOrder)', async () => {
    const db = as(env, ANA).firestore();
    await assertFails(
      setDoc(doc(db, orderPaths.order(A, 'novo')), { customerUid: ANA, totalCents: 1 }),
    );
    await assertFails(updateDoc(doc(db, orderPaths.order(A, 'o1')), { status: 'delivered' }));
    await assertFails(updateDoc(doc(db, orderPaths.order(A, 'o1')), { totalCents: 1 }));
    await assertFails(deleteDoc(doc(db, orderPaths.order(A, 'o1'))));
  });

  it('visitante sem login não lê pedido', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, orderPaths.order(A, 'o1'))));
  });

  for (const role of TENANT_ROLES) {
    it(`${role} da empresa B não lê pedidos da empresa A`, async () => {
      const db = staffOf(env, B, role).firestore();
      await assertFails(getDoc(doc(db, orderPaths.order(A, 'o1'))));
      await assertFails(getDocs(collection(db, orderPaths.orders(A))));
      await assertFails(getDoc(doc(db, orderPaths.courierPosition(A, 'o1'))));
    });
  }

  it('equipe da empresa A lê os pedidos da própria empresa', async () => {
    const db = staffOf(env, A, 'attendant').firestore();
    await assertSucceeds(getDocs(query(collection(db, orderPaths.orders(A)), limit(50))));
  });

  it('posição do entregador: só o cliente do pedido e a loja leem; ninguém grava pelo app', async () => {
    await assertSucceeds(
      getDoc(doc(as(env, ANA).firestore(), orderPaths.courierPosition(A, 'o1'))),
    );
    await assertFails(getDoc(doc(as(env, BRUNO).firestore(), orderPaths.courierPosition(A, 'o1'))));
    await assertFails(
      setDoc(doc(as(env, ANA).firestore(), orderPaths.courierPosition(A, 'o1')), {
        customerUid: ANA,
        lat: 0,
        lng: 0,
      }),
    );
  });

  it('contador de pedidos não é acessível pelo app', async () => {
    await assertFails(getDoc(doc(as(env, ANA).firestore(), orderPaths.orderCounter(A))));
    await assertFails(
      setDoc(doc(staffOf(env, A, 'owner').firestore(), orderPaths.orderCounter(A)), { last: 1 }),
    );
  });
});

describe('categorias públicas', () => {
  it('qualquer visitante lê, ninguém grava pelo app', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(collection(anon, orderPaths.publicCategories(A))));
    await assertFails(
      setDoc(doc(staffOf(env, A, 'owner').firestore(), orderPaths.publicCategory(A, 'x')), {
        name: 'X',
        parentId: null,
        displayOrder: 0,
      }),
    );
  });
});

describe('endereços do cliente', () => {
  it('cliente cria, lê, edita e apaga os próprios endereços', async () => {
    const db = as(env, ANA).firestore();
    const ref = doc(db, orderPaths.address(ANA, 'casa'));
    await assertSucceeds(setDoc(ref, address()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { number: '1001', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('ninguém lê nem grava endereço de outra pessoa', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), orderPaths.address(ANA, 'casa')), address());
    });
    const bruno = as(env, BRUNO).firestore();
    await assertFails(getDoc(doc(bruno, orderPaths.address(ANA, 'casa'))));
    await assertFails(getDocs(collection(bruno, orderPaths.addresses(ANA))));
    await assertFails(setDoc(doc(bruno, orderPaths.address(ANA, 'novo')), address()));
    const owner = staffOf(env, A, 'owner').firestore();
    await assertFails(getDoc(doc(owner, orderPaths.address(ANA, 'casa'))));
  });

  it('recusa endereço sem ponto no mapa, com campo extra ou CEP inválido', async () => {
    const db = as(env, ANA).firestore();
    const ref = doc(db, orderPaths.address(ANA, 'x'));
    await assertFails(setDoc(ref, address({ location: null })));
    await assertFails(setDoc(ref, address({ cep: '0131' })));
    await assertFails(setDoc(ref, address({ admin: true })));
    await assertFails(setDoc(ref, address({ createdAt: Timestamp.fromMillis(0) })));
  });
});
