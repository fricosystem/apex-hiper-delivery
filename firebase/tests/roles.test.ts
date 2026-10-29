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
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { paths } from '@hiper/shared';
import { A, categoryDoc, costDoc, createEnv, productDoc, seed, staffOf } from './setup';

/** Permissões por perfil dentro da mesma empresa. */

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

const stamp = (uid: string) => ({ updatedBy: uid, updatedAt: serverTimestamp() });

describe('produtos e categorias', () => {
  for (const role of ['owner', 'manager'] as const) {
    it(`${role} cadastra, edita e exclui produto e categoria`, async () => {
      const uid = `${role}-${A}`;
      const db = staffOf(env, A, role).firestore();
      await assertSucceeds(setDoc(doc(db, paths.product(A, 'novo')), productDoc(uid)));
      await assertSucceeds(
        updateDoc(doc(db, paths.product(A, 'novo')), {
          'pricing.salePriceCents': 2790,
          ...stamp(uid),
        }),
      );
      await assertSucceeds(deleteDoc(doc(db, paths.product(A, 'novo'))));
      await assertSucceeds(
        setDoc(doc(db, paths.category(A, 'bebidas')), categoryDoc(uid, { name: 'Bebidas' })),
      );
      await assertSucceeds(
        updateDoc(doc(db, paths.category(A, 'bebidas')), { displayOrder: 2, ...stamp(uid) }),
      );
      await assertSucceeds(deleteDoc(doc(db, paths.category(A, 'bebidas'))));
    });
  }

  for (const role of ['finance', 'hr', 'attendant', 'picker'] as const) {
    it(`${role} lê produtos mas não cadastra, edita preço nem exclui`, async () => {
      const uid = `${role}-${A}`;
      const db = staffOf(env, A, role).firestore();
      await assertSucceeds(getDoc(doc(db, paths.product(A, 'p1'))));
      await assertSucceeds(getDocs(collection(db, paths.categories(A))));
      await assertFails(setDoc(doc(db, paths.product(A, 'novo')), productDoc(uid)));
      await assertFails(
        updateDoc(doc(db, paths.product(A, 'p1')), { 'pricing.salePriceCents': 1, ...stamp(uid) }),
      );
      await assertFails(deleteDoc(doc(db, paths.product(A, 'p1'))));
      await assertFails(setDoc(doc(db, paths.category(A, 'x')), categoryDoc(uid)));
    });
  }

  it('atendente pausa e reativa produto, e só isso', async () => {
    const uid = `attendant-${A}`;
    const db = staffOf(env, A, 'attendant').firestore();
    await assertSucceeds(
      updateDoc(doc(db, paths.product(A, 'p1')), { paused: true, ...stamp(uid) }),
    );
    await assertSucceeds(
      updateDoc(doc(db, paths.product(A, 'p1')), { paused: false, ...stamp(uid) }),
    );
    await assertFails(
      updateDoc(doc(db, paths.product(A, 'p1')), { paused: true, name: 'Outro', ...stamp(uid) }),
    );
    await assertFails(updateDoc(doc(db, paths.product(A, 'p1')), { paused: 'sim', ...stamp(uid) }));
    // Sem carimbo de quem alterou, não passa.
    await assertFails(updateDoc(doc(db, paths.product(A, 'p1')), { paused: true }));
  });

  it('separador não pausa produto', async () => {
    const uid = `picker-${A}`;
    const db = staffOf(env, A, 'picker').firestore();
    await assertFails(updateDoc(doc(db, paths.product(A, 'p1')), { paused: true, ...stamp(uid) }));
  });
});

describe('custo de compra e fornecedores', () => {
  for (const role of ['owner', 'manager', 'finance'] as const) {
    it(`${role} lê e grava o custo`, async () => {
      const uid = `${role}-${A}`;
      const db = staffOf(env, A, role).firestore();
      await assertSucceeds(getDoc(doc(db, paths.productCost(A, 'p1'))));
      await assertSucceeds(
        updateDoc(doc(db, paths.productCost(A, 'p1')), { purchasePriceCents: 1300, ...stamp(uid) }),
      );
    });
  }

  for (const role of ['hr', 'attendant', 'picker'] as const) {
    it(`${role} não vê nem grava o custo`, async () => {
      const uid = `${role}-${A}`;
      const db = staffOf(env, A, role).firestore();
      await assertFails(getDoc(doc(db, paths.productCost(A, 'p1'))));
      await assertFails(getDocs(collection(db, `tenants/${A}/productCosts`)));
      await assertFails(
        updateDoc(doc(db, paths.productCost(A, 'p1')), { purchasePriceCents: 1, ...stamp(uid) }),
      );
    });
  }

  it('custo só é criado para produto que existe', async () => {
    const uid = `owner-${A}`;
    const db = staffOf(env, A, 'owner').firestore();
    await assertFails(setDoc(doc(db, paths.productCost(A, 'nao-existe')), costDoc(uid)));
    await assertSucceeds(setDoc(doc(db, paths.product(A, 'p2')), productDoc(uid)));
    await assertSucceeds(setDoc(doc(db, paths.productCost(A, 'p2')), costDoc(uid)));
  });

  it('financeiro grava custo mas não exclui', async () => {
    const db = staffOf(env, A, 'finance').firestore();
    await assertFails(deleteDoc(doc(db, paths.productCost(A, 'p1'))));
  });
});

describe('cadastro da empresa', () => {
  it('gerente muda nome fantasia e contato, mas não dados legais', async () => {
    const uid = `manager-${A}`;
    const db = staffOf(env, A, 'manager').firestore();
    await assertSucceeds(
      updateDoc(doc(db, paths.tenant(A)), {
        tradeName: 'Lanche Bom',
        phone: '11987654321',
        ...stamp(uid),
      }),
    );
    await assertFails(
      updateDoc(doc(db, paths.tenant(A)), { cnpj: '11222333000181', ...stamp(uid) }),
    );
  });

  it('dono muda dados legais', async () => {
    const uid = `owner-${A}`;
    const db = staffOf(env, A, 'owner').firestore();
    await assertSucceeds(
      updateDoc(doc(db, paths.tenant(A)), {
        legalName: 'Lanche Bom LTDA',
        cnpj: '11222333000181',
        taxRegime: 'simples_nacional',
        ...stamp(uid),
      }),
    );
    await assertFails(
      updateDoc(doc(db, paths.tenant(A)), { cnpj: '11.222.333/0001-81', ...stamp(uid) }),
    );
    await assertFails(
      updateDoc(doc(db, paths.tenant(A)), { taxRegime: 'inventado', ...stamp(uid) }),
    );
  });

  it('ninguém muda status, plano, endereço da loja ou dono pelo app', async () => {
    const uid = `owner-${A}`;
    const db = staffOf(env, A, 'owner').firestore();
    for (const change of [
      { status: 'active' },
      { plan: 'complete' },
      { slug: 'outro' },
      { ownerUid: 'outro' },
      { trialEndsAt: serverTimestamp() },
    ]) {
      await assertFails(updateDoc(doc(db, paths.tenant(A)), { ...change, ...stamp(uid) }));
    }
  });

  it('logo só pode apontar para arquivo da própria empresa', async () => {
    const uid = `owner-${A}`;
    const db = staffOf(env, A, 'owner').firestore();
    await assertSucceeds(
      updateDoc(doc(db, paths.tenant(A)), {
        logoPath: `tenants/${A}/public/logo/a.png`,
        ...stamp(uid),
      }),
    );
    await assertFails(
      updateDoc(doc(db, paths.tenant(A)), {
        logoPath: `tenants/tenantB/public/logo/a.png`,
        ...stamp(uid),
      }),
    );
  });

  for (const role of ['finance', 'hr', 'attendant', 'picker'] as const) {
    it(`${role} não altera o cadastro da empresa`, async () => {
      const uid = `${role}-${A}`;
      const db = staffOf(env, A, role).firestore();
      await assertSucceeds(getDoc(doc(db, paths.tenant(A))));
      await assertFails(updateDoc(doc(db, paths.tenant(A)), { tradeName: 'Outro', ...stamp(uid) }));
    });
  }
});

describe('equipe e auditoria', () => {
  it('dono e gerente veem a equipe; os demais só o próprio registro', async () => {
    await assertSucceeds(
      getDocs(collection(staffOf(env, A, 'manager').firestore(), paths.members(A))),
    );
    const db = staffOf(env, A, 'attendant').firestore();
    await assertSucceeds(getDoc(doc(db, paths.member(A, `attendant-${A}`))));
    await assertFails(getDoc(doc(db, paths.member(A, `owner-${A}`))));
    await assertFails(getDocs(collection(db, paths.members(A))));
  });

  it('só o dono lê a auditoria', async () => {
    await assertSucceeds(
      getDocs(collection(staffOf(env, A, 'owner').firestore(), paths.auditLog(A))),
    );
    await assertFails(
      getDocs(collection(staffOf(env, A, 'manager').firestore(), paths.auditLog(A))),
    );
  });
});
