import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { paths } from '@hiper/shared';
import {
  A,
  as,
  categoryDoc,
  costDoc,
  createEnv,
  productDoc,
  sampleProductInput,
  seed,
  staffOf,
} from './setup';

/** Formato dos documentos que a equipe grava direto pelo painel. */

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

const uid = `owner-${A}`;
const owner = () => staffOf(env, A, 'owner').firestore();
const create = (over: Record<string, unknown>) =>
  setDoc(doc(owner(), paths.product(A, 'novo')), productDoc(uid, over));

describe('produto', () => {
  it('aceita o produto completo gerado pelo schema compartilhado', async () => {
    await assertSucceeds(create({}));
  });

  it('recusa campo desconhecido (ex.: custo dentro da ficha)', async () => {
    await assertFails(create({ purchasePriceCents: 1000 }));
  });

  it('recusa ficha sem uma das abas', async () => {
    const { fiscal: _fiscal, ...withoutFiscal } = productDoc(uid);
    await assertFails(setDoc(doc(owner(), paths.product(A, 'novo')), withoutFiscal));
  });

  it('recusa preço em reais com centavos (float) ou negativo', async () => {
    await assertFails(create({ pricing: { salePriceCents: 25.9, promo: null } }));
    await assertFails(create({ pricing: { salePriceCents: -1, promo: null } }));
  });

  it('recusa promoção maior que o preço ou com fim antes do início', async () => {
    await assertFails(
      create({
        pricing: { salePriceCents: 1000, promo: { priceCents: 1000, startsAtMs: 1, endsAtMs: 2 } },
      }),
    );
    await assertFails(
      create({
        pricing: { salePriceCents: 1000, promo: { priceCents: 900, startsAtMs: 2, endsAtMs: 1 } },
      }),
    );
    await assertSucceeds(
      create({
        pricing: { salePriceCents: 1000, promo: { priceCents: 900, startsAtMs: 1, endsAtMs: 2 } },
      }),
    );
  });

  it('recusa nome vazio, unidade inválida e listas grandes demais', async () => {
    await assertFails(create({ name: '' }));
    await assertFails(create({ saleUnit: 'tonelada' }));
    await assertFails(create({ gtins: Array.from({ length: 11 }, (_, i) => `789100010010${i}`) }));
    await assertFails(create({ photos: Array.from({ length: 11 }, (_, i) => `f${i}.webp`) }));
  });

  it('exige carimbo do servidor e do próprio usuário', async () => {
    await assertFails(create({ createdBy: 'outra-pessoa' }));
    await assertFails(create({ createdAt: Timestamp.fromMillis(0) }));
    await assertFails(create({ updatedAt: Timestamp.fromMillis(0) }));
  });

  it('na edição, não deixa reescrever quem criou nem remover abas', async () => {
    const ref = doc(owner(), paths.product(A, 'p1'));
    await assertFails(
      updateDoc(ref, { createdBy: 'outra-pessoa', updatedBy: uid, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(ref, { stock: deleteField(), updatedBy: uid, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(ref, {
        'stock.tracked': true,
        'stock.quantity': 12,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('o produto gravado tem as abas completas', async () => {
    await assertSucceeds(create({}));
    const snap = await getDoc(doc(owner(), paths.product(A, 'novo')));
    const expected = Object.keys(sampleProductInput());
    for (const key of expected) {
      if (!snap.data()?.hasOwnProperty(key)) throw new Error(`faltou ${key}`);
    }
  });
});

describe('categoria e custo', () => {
  it('categoria não pode ser pai de si mesma', async () => {
    await assertFails(
      setDoc(doc(owner(), paths.category(A, 'c1')), categoryDoc(uid, { parentId: 'c1' })),
    );
    await assertSucceeds(
      setDoc(doc(owner(), paths.category(A, 'c1')), categoryDoc(uid, { parentId: 'lanches' })),
    );
  });

  it('custo em centavos inteiros e sem campos extras', async () => {
    const ref = doc(owner(), paths.productCost(A, 'p1'));
    await assertFails(setDoc(ref, costDoc(uid, { purchasePriceCents: 12.5 })));
    await assertFails(setDoc(ref, costDoc(uid, { margin: 40 })));
  });
});

describe('perfil pessoal', () => {
  const profile = (over: Record<string, unknown> = {}) => ({
    displayName: 'Maria',
    phone: null,
    marketingOptIn: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over,
  });

  it('cada pessoa cria, lê e edita só o próprio perfil', async () => {
    const db = as(env, 'maria').firestore();
    await assertSucceeds(setDoc(doc(db, paths.user('maria')), profile()));
    await assertSucceeds(getDoc(doc(db, paths.user('maria'))));
    await assertSucceeds(
      updateDoc(doc(db, paths.user('maria')), {
        marketingOptIn: true,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(as(env, 'joao').firestore(), paths.user('maria'))));
    await assertFails(setDoc(doc(db, paths.user('joao')), profile()));
  });

  it('perfil não aceita empresa ou perfil de acesso', async () => {
    const db = as(env, 'maria').firestore();
    await assertFails(setDoc(doc(db, paths.user('maria')), profile({ tid: A })));
    await assertFails(setDoc(doc(db, paths.user('maria')), profile({ role: 'owner' })));
  });

  it('vínculo com empresa é lido só pelo próprio usuário', async () => {
    await assertSucceeds(
      getDoc(doc(as(env, `owner-${A}`).firestore(), 'memberships/owner-tenantA')),
    );
    await assertFails(getDoc(doc(as(env, 'outro').firestore(), 'memberships/owner-tenantA')));
  });
});
