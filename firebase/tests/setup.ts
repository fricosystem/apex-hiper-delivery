import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import {
  paths,
  productCostInputSchema,
  productInputSchema,
  productSearchKeywords,
  toCatalogItem,
  type HiperClaims,
  type TenantRole,
} from '@hiper/shared';

export const PROJECT_ID = 'demo-hiper-delivery';
export const A = 'tenantA';
export const B = 'tenantB';

const rule = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8');

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: rule('firestore.rules') },
    storage: { rules: rule('storage.rules') },
  });
}

/** Usuário com os claims que as Functions gravariam. */
export function as(
  env: RulesTestEnvironment,
  uid: string,
  claims: HiperClaims = {},
): RulesTestContext {
  return env.authenticatedContext(uid, claims as Record<string, unknown>);
}

export function staffOf(env: RulesTestEnvironment, tenantId: string, role: TenantRole) {
  return as(env, `${role}-${tenantId}`, { tid: tenantId, role });
}

export const sampleProductInput = () =>
  productInputSchema.parse({
    internalCode: 'XB-01',
    gtins: ['7891000100103'],
    name: 'X-Burger',
    description: 'Pão, hambúrguer 150 g, queijo',
    pricing: { salePriceCents: 2590 },
    fiscal: { ncm: '21069090', cfop: '5102' },
  });

/** Documento de produto como o painel gravaria (com carimbo do servidor). */
export function productDoc(uid: string, over: Record<string, unknown> = {}) {
  const input = sampleProductInput();
  return {
    ...input,
    searchKeywords: productSearchKeywords(input),
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...over,
  };
}

export function costDoc(uid: string, over: Record<string, unknown> = {}) {
  return {
    ...productCostInputSchema.parse({ purchasePriceCents: 1200, purchaseFreightCents: 50 }),
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...over,
  };
}

export function categoryDoc(uid: string, over: Record<string, unknown> = {}) {
  return {
    name: 'Lanches',
    parentId: null,
    displayOrder: 0,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...over,
  };
}

/** Dados como as Functions deixariam: duas empresas completas, A e B. */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const past = Timestamp.fromMillis(Date.now() - 60_000);
    for (const t of [A, B]) {
      const owner = `owner-${t}`;
      await setDoc(doc(db, paths.tenant(t)), {
        tradeName: `Loja ${t}`,
        slug: `loja-${t.toLowerCase()}`,
        segment: 'restaurant',
        phone: null,
        email: null,
        address: null,
        logoPath: null,
        legalName: null,
        cnpj: null,
        stateRegistration: null,
        taxRegime: null,
        ownerUid: owner,
        status: 'trial',
        plan: 'essential',
        trialEndsAt: past,
        createdAt: past,
        updatedAt: past,
        updatedBy: owner,
      });
      for (const role of ['owner', 'manager', 'finance', 'attendant', 'picker'] as const) {
        const uid = `${role}-${t}`;
        await setDoc(doc(db, paths.member(t, uid)), { uid, role, active: true });
        await setDoc(doc(db, `memberships/${uid}`), { tenantId: t, role });
      }
      const stamps = { createdAt: past, createdBy: owner, updatedAt: past, updatedBy: owner };
      await setDoc(doc(db, paths.category(t, 'lanches')), { ...categoryDoc(owner), ...stamps });
      await setDoc(doc(db, paths.product(t, 'p1')), { ...productDoc(owner), ...stamps });
      await setDoc(doc(db, paths.productCost(t, 'p1')), { ...costDoc(owner), ...stamps });
      const input = sampleProductInput();
      await setDoc(
        doc(db, paths.catalogItem(t, 'p1')),
        toCatalogItem({ ...input, searchKeywords: productSearchKeywords(input) })!,
      );
      await setDoc(doc(db, `${paths.auditLog(t)}/e1`), {
        action: 'tenant.created',
        actorUid: owner,
      });
      await setDoc(doc(db, paths.publicStore(`loja-${t.toLowerCase()}`)), {
        tenantId: t,
        tradeName: `Loja ${t}`,
        segment: 'restaurant',
        logoPath: null,
        open: true,
      });
    }
  });
}
