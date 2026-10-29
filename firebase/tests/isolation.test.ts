import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
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
} from 'firebase/firestore';
import { paths, TENANT_ROLES } from '@hiper/shared';
import { A, as, B, categoryDoc, costDoc, createEnv, productDoc, seed, staffOf } from './setup';

/**
 * Testes de vazamento: cada perfil da empresa B tenta ler e gravar dados da
 * empresa A. Nenhuma tentativa pode passar.
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
});

const tenantAPaths = [
  paths.tenant(A),
  paths.member(A, 'owner-tenantA'),
  paths.category(A, 'lanches'),
  paths.product(A, 'p1'),
  paths.productCost(A, 'p1'),
  `${paths.auditLog(A)}/e1`,
];

describe('isolamento entre empresas', () => {
  for (const role of TENANT_ROLES) {
    it(`${role} da empresa B não lê nenhum documento interno da empresa A`, async () => {
      const db = staffOf(env, B, role).firestore();
      for (const p of tenantAPaths) {
        await assertFails(getDoc(doc(db, p)));
      }
    });
  }

  it('dono da empresa B não lista produtos, categorias, custos nem equipe da empresa A', async () => {
    const db = staffOf(env, B, 'owner').firestore();
    for (const c of [
      paths.products(A),
      paths.categories(A),
      `tenants/${A}/productCosts`,
      paths.members(A),
    ]) {
      await assertFails(getDocs(collection(db, c)));
    }
  });

  it('dono da empresa B não grava nada na empresa A', async () => {
    const db = staffOf(env, B, 'owner').firestore();
    const uid = 'owner-tenantB';
    await assertFails(setDoc(doc(db, paths.product(A, 'novo')), productDoc(uid)));
    await assertFails(setDoc(doc(db, paths.category(A, 'nova')), categoryDoc(uid)));
    await assertFails(setDoc(doc(db, paths.productCost(A, 'p1')), costDoc(uid)));
    await assertFails(
      updateDoc(doc(db, paths.product(A, 'p1')), {
        paused: true,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(doc(db, paths.product(A, 'p1'))));
    await assertFails(
      updateDoc(doc(db, paths.tenant(A)), {
        tradeName: 'Invadida',
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('claim de empresa com perfil desconhecido não dá acesso', async () => {
    const db = as(env, 'x', { tid: A, role: 'superuser' as never }).firestore();
    await assertFails(getDoc(doc(db, paths.product(A, 'p1'))));
  });

  it('usuário sem empresa (cliente) não lê dados internos de nenhuma empresa', async () => {
    const db = as(env, 'cliente-1').firestore();
    for (const p of tenantAPaths) {
      await assertFails(getDoc(doc(db, p)));
    }
  });

  it('entregador não lê dados internos da loja', async () => {
    const db = as(env, 'motoboy-1', { courier: true }).firestore();
    await assertFails(getDoc(doc(db, paths.product(A, 'p1'))));
    await assertFails(getDoc(doc(db, paths.tenant(A))));
  });

  it('equipe interna lê o cadastro da empresa, mas não os dados internos dela', async () => {
    const db = as(env, 'suporte-1', { staff: 'support' }).firestore();
    await assertSucceeds(getDoc(doc(db, paths.tenant(A))));
    await assertFails(getDoc(doc(db, paths.product(A, 'p1'))));
    await assertFails(getDoc(doc(db, paths.productCost(A, 'p1'))));
    await assertFails(getDoc(doc(db, paths.member(A, 'owner-tenantA'))));
  });

  it('a própria empresa lê os seus dados', async () => {
    const db = staffOf(env, A, 'owner').firestore();
    for (const p of tenantAPaths) {
      await assertSucceeds(getDoc(doc(db, p)));
    }
  });
});

describe('vitrine pública e endereço da loja', () => {
  it('qualquer pessoa, mesmo sem login, lê o catálogo e o endereço da loja', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, paths.catalogItem(A, 'p1'))));
    await assertSucceeds(getDocs(collection(db, paths.catalog(A))));
    await assertSucceeds(getDoc(doc(db, paths.publicStore('loja-tenanta'))));
    await assertSucceeds(getDocs(query(collection(db, 'publicStores'), where('open', '==', true))));
  });

  it('ninguém grava catálogo, endereço, equipe, vínculo ou auditoria pelo app', async () => {
    const db = staffOf(env, A, 'owner').firestore();
    await assertFails(setDoc(doc(db, paths.catalogItem(A, 'p1')), { name: 'x' }));
    await assertFails(setDoc(doc(db, paths.publicStore('minha-loja')), { tenantId: A }));
    await assertFails(setDoc(doc(db, paths.member(A, 'intruso')), { role: 'owner' }));
    await assertFails(updateDoc(doc(db, paths.member(A, 'attendant-tenantA')), { role: 'owner' }));
    await assertFails(setDoc(doc(db, 'memberships/owner-tenantA'), { tenantId: B, role: 'owner' }));
    await assertFails(setDoc(doc(db, `${paths.auditLog(A)}/e2`), { action: 'x' }));
    await assertFails(deleteDoc(doc(db, `${paths.auditLog(A)}/e1`)));
  });

  it('ninguém cria empresa direto pelo app', async () => {
    const db = as(env, 'novo-lojista').firestore();
    await assertFails(
      setDoc(doc(db, paths.tenant('minha')), { tradeName: 'Minha', ownerUid: 'novo-lojista' }),
    );
  });

  it('caminhos fora do modelo são negados', async () => {
    const db = staffOf(env, A, 'owner').firestore();
    await assertFails(getDoc(doc(db, 'qualquer/coisa')));
    await assertFails(setDoc(doc(db, `tenants/${A}/outra/x`), { a: 1 }));
  });
});
